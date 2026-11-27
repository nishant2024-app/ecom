import { newId } from '@dairy/core';
import { schema as s } from '@dairy/db';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import { and, asc, desc, eq, max } from 'drizzle-orm';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { audit } from '../../lib/audit';
import { AppError, badRequest, notFound } from '../../lib/errors';
import { loadContent } from '../../services/content';
import { defaultSellerId } from '../../services/store';
import { IdParam } from '../../lib/schemas';
import { deleteImage, imageOut, storeImage } from '../../services/images';

export const ImageOut = Type.Object({
  id: Type.String(),
  url: Type.String(),
  alt: Type.String(),
  width: Type.Integer(),
  height: Type.Integer(),
  srcset: Type.Array(Type.Object({ url: Type.String(), width: Type.Integer() })),
});

/** Read every file part of a multipart request (images only), plus an optional `alt` field. */
async function readUploads(req: FastifyRequest) {
  if (!req.isMultipart()) throw badRequest('Send the photo as multipart/form-data with a "file" field');
  const files: Buffer[] = [];
  let alt = '';
  for await (const part of req.parts()) {
    if (part.type === 'file') {
      const buf = await part.toBuffer();
      if (part.file.truncated) throw badRequest('Images must be under 20 MB');
      if (buf.length) files.push(buf);
    } else if (part.fieldname === 'alt') {
      alt = String(part.value ?? '').slice(0, 200);
    }
  }
  if (!files.length) throw badRequest('No image file was uploaded');
  return { files, alt };
}

export default async function adminMediaRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<TypeBoxTypeProvider>();
  const { db } = app.deps.db;
  const storage = app.deps.storage!;
  const write = { auth: 'staff', permission: 'catalog.write' } as const;

  const listFor = async (productId: string) =>
    (await db.select().from(s.productMedia).where(eq(s.productMedia.productId, productId)).orderBy(asc(s.productMedia.sort), asc(s.productMedia.createdAt))).map((m) =>
      imageOut(storage, { id: m.id, width: m.width, height: m.height, variants: m.variants, alt: m.altEn }),
    );

  app.get(
    '/products/:productId/media',
    { config: { auth: 'staff', permission: 'catalog.read' }, schema: { tags: ['Admin'], summary: 'Product photos, in display order', params: IdParam('productId'), response: { 200: Type.Object({ data: Type.Array(ImageOut) }) } } },
    async (req) => ({ data: await listFor(req.params.productId) }),
  );

  app.post(
    '/products/:productId/media',
    {
      config: write,
      schema: {
        tags: ['Admin'],
        summary: 'Upload product photos (multipart, field "file", repeatable; optional "alt")',
        description: 'JPG, PNG, WebP or HEIC, up to 20 MB each and at least 400 px wide. Stored as WebP at 480, 960 and 1600 px. The first photo is the main product image.',
        params: IdParam('productId'),
        consumes: ['multipart/form-data'],
        response: { 201: Type.Object({ data: Type.Array(ImageOut) }) },
      },
    },
    async (req, reply) => {
      const [product] = await db.select({ id: s.products.id, slug: s.products.slug, name: s.products.nameEn }).from(s.products).where(eq(s.products.id, req.params.productId));
      if (!product) throw notFound('Product');
      const { files, alt } = await readUploads(req);
      const [{ top } = { top: null }] = await db.select({ top: max(s.productMedia.sort) }).from(s.productMedia).where(eq(s.productMedia.productId, product.id));
      let sort = (top ?? -1) + 1;
      for (const file of files) {
        const id = newId('med');
        const stored = await storeImage(storage, file, `products/${product.slug}/${id}`);
        await db.insert(s.productMedia).values({
          id,
          productId: product.id,
          kind: 'image',
          r2Key: stored.variants.at(-1)!.key,
          width: stored.width,
          height: stored.height,
          variants: stored.variants,
          altEn: alt || product.name,
          sort: sort++,
        });
        await audit(db, req, 'product.media.add', 'product', product.id, null, { mediaId: id });
      }
      return reply.status(201).send({ data: await listFor(product.id) });
    },
  );

  app.put(
    '/products/:productId/media/order',
    {
      config: write,
      schema: {
        tags: ['Admin'],
        summary: 'Reorder product photos; the first is the main image',
        params: IdParam('productId'),
        body: Type.Object({ ids: Type.Array(Type.String(), { minItems: 1, maxItems: 30 }) }, { additionalProperties: false }),
        response: { 200: Type.Object({ data: Type.Array(ImageOut) }) },
      },
    },
    async (req) => {
      const current = await db.select({ id: s.productMedia.id }).from(s.productMedia).where(eq(s.productMedia.productId, req.params.productId));
      const known = new Set(current.map((c) => c.id));
      if (req.body.ids.length !== known.size || !req.body.ids.every((id) => known.has(id))) throw badRequest('List every photo of this product exactly once');
      await db.transaction(async (tx) => {
        for (const [i, id] of req.body.ids.entries()) await tx.update(s.productMedia).set({ sort: i }).where(eq(s.productMedia.id, id));
      });
      await audit(db, req, 'product.media.reorder', 'product', req.params.productId, null, req.body.ids);
      return { data: await listFor(req.params.productId) };
    },
  );

  app.patch(
    '/media/:mediaId',
    {
      config: write,
      schema: {
        tags: ['Admin'],
        summary: 'Edit a product photo\'s alt text',
        params: IdParam('mediaId'),
        body: Type.Object({ alt: Type.String({ maxLength: 200 }) }, { additionalProperties: false }),
        response: { 200: ImageOut },
      },
    },
    async (req) => {
      const [row] = await db.update(s.productMedia).set({ altEn: req.body.alt }).where(eq(s.productMedia.id, req.params.mediaId)).returning();
      if (!row) throw notFound('Photo');
      return imageOut(storage, { id: row.id, width: row.width, height: row.height, variants: row.variants, alt: row.altEn });
    },
  );

  app.delete(
    '/media/:mediaId',
    { config: write, schema: { tags: ['Admin'], summary: 'Delete a product photo', params: IdParam('mediaId'), response: { 204: Type.Null() } } },
    async (req, reply) => {
      const [row] = await db.delete(s.productMedia).where(eq(s.productMedia.id, req.params.mediaId)).returning();
      if (!row) throw notFound('Photo');
      await deleteImage(storage, row.variants);
      await audit(db, req, 'product.media.delete', 'product', row.productId, { mediaId: row.id }, null);
      return reply.status(204).send(null);
    },
  );

  // ---- Site images (hero, story, banners) ----

  app.get(
    '/site-media',
    { config: { auth: 'staff', permission: 'catalog.read' }, schema: { tags: ['Admin'], summary: 'Storefront image library', response: { 200: Type.Object({ data: Type.Array(ImageOut) }) } } },
    async () => ({ data: (await db.select().from(s.siteMedia).orderBy(desc(s.siteMedia.createdAt)).limit(200)).map((r) => imageOut(storage, r)) }),
  );

  app.post(
    '/site-media',
    {
      config: write,
      schema: { tags: ['Admin'], summary: 'Upload storefront images (multipart, field "file"; optional "alt")', consumes: ['multipart/form-data'], response: { 201: Type.Object({ data: Type.Array(ImageOut) }) } },
    },
    async (req, reply) => {
      const { files, alt } = await readUploads(req);
      const out = [];
      for (const file of files) {
        const id = newId('med');
        const stored = await storeImage(storage, file, `site/${id}`);
        const [row] = await db.insert(s.siteMedia).values({ id, key: stored.variants.at(-1)!.key, width: stored.width, height: stored.height, variants: stored.variants, alt }).returning();
        out.push(imageOut(storage, row!));
      }
      return reply.status(201).send({ data: out });
    },
  );

  app.delete(
    '/site-media/:mediaId',
    { config: write, schema: { tags: ['Admin'], summary: 'Delete a storefront image', params: IdParam('mediaId'), response: { 204: Type.Null() } } },
    async (req, reply) => {
      const content = await loadContent(db, await defaultSellerId(db));
      if ([content.hero.imageId, content.story.imageId, ...content.banners.map((b) => b.imageId)].includes(req.params.mediaId)) {
        throw new AppError('CONFLICT', 409, 'This photo is on the storefront. Choose a different photo there first.');
      }
      const [row] = await db.delete(s.siteMedia).where(and(eq(s.siteMedia.id, req.params.mediaId))).returning();
      if (!row) throw notFound('Image');
      await deleteImage(storage, row.variants);
      return reply.status(204).send(null);
    },
  );
}
