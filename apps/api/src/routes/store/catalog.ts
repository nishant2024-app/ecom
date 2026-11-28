import { addDays, daysBetween, todayIST, unitPrice } from '@dairy/core';
import { schema as s } from '@dairy/db';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import { and, asc, desc, eq, gte, inArray, sql, type SQL } from 'drizzle-orm';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { notFound } from '../../lib/errors';
import { ErrorResponses, Money, Nullable, PageInfo, decodeCursor, encodeCursor, money } from '../../lib/schemas';
import { imageOut } from '../../services/images';
import { ratings } from '../../services/reviews';
import { availability, nextBatches } from '../../services/stock';

export const lang = (req: FastifyRequest): 'en' | 'hi' =>
  String(req.headers['accept-language'] ?? '')
    .toLowerCase()
    .startsWith('hi')
    ? 'hi'
    : 'en';

export const PackSchema = Type.Object({ kind: Type.String(), color: Type.String(), accent: Type.String() });
const Image = Type.Object({
  url: Type.String(),
  alt: Type.String(),
  width: Type.Integer(),
  height: Type.Integer(),
  srcset: Type.Array(Type.Object({ url: Type.String(), width: Type.Integer() })),
});
const Variant = Type.Object({
  id: Type.String(),
  sku: Type.String(),
  packSize: Type.String(),
  price: Money,
  mrp: Money,
  weightGrams: Type.Integer(),
  shelfLifeDays: Type.Integer(),
  inStock: Type.Boolean(),
  lowStock: Type.Boolean(),
  maxPerOrder: Type.Integer(),
  unitPrice: Nullable(Type.Object({ amount: Money, per: Type.String() })),
  /** The batch this size ships from next: proof of freshness before buying. */
  nextBatch: Nullable(Type.Object({ manufacturedOn: Type.String(), bestBefore: Type.String() })),
});
const ProductSummary = Type.Object({
  id: Type.String(),
  slug: Type.String(),
  name: Type.String(),
  tagline: Type.String(),
  category: Type.Object({ slug: Type.String(), name: Type.String() }),
  pack: PackSchema,
  image: Nullable(Image),
  isVeg: Type.Boolean(),
  featured: Type.Boolean(),
  attributes: Type.Record(Type.String(), Type.Unknown()),
  fromPrice: Money,
  rating: Nullable(Type.Object({ average: Type.Number(), count: Type.Integer() })),
  variants: Type.Array(Variant),
});
const ProductDetail = Type.Intersect([
  ProductSummary,
  Type.Object({
    description: Type.String(),
    nutrition: Type.Array(Type.Object({ label: Type.String(), per100: Type.String() })),
    storage: Type.String(),
    hsnCode: Type.String(),
    fssaiNumber: Nullable(Type.String()),
    gallery: Type.Array(Image),
    related: Type.Array(ProductSummary),
  }),
]);

/** "doo pow" → 'doo:* & pow:*' */
function prefixQuery(q: string): string | null {
  const words = q
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter(Boolean)
    .slice(0, 6);
  return words.length ? words.map((w) => `${w}:*`).join(' & ') : null;
}

export default async function catalogRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<TypeBoxTypeProvider>();
  const { db } = app.deps.db;
  const storage = app.deps.storage!;

  async function loadProducts(where: SQL[], language: 'en' | 'hi') {
    const rows = await db
      .select({ p: s.products, c: s.categories })
      .from(s.products)
      .innerJoin(s.categories, eq(s.categories.id, s.products.categoryId))
      .where(and(eq(s.products.status, 'active'), ...where))
      .orderBy(asc(s.categories.sort), asc(s.products.sort), asc(s.products.id));
    if (rows.length === 0) return [];
    const ids = rows.map((r) => r.p.id);
    const [variants, media] = await Promise.all([
      db
        .select()
        .from(s.productVariants)
        .where(and(inArray(s.productVariants.productId, ids), eq(s.productVariants.status, 'active')))
        .orderBy(asc(s.productVariants.sort)),
      db.select().from(s.productMedia).where(inArray(s.productMedia.productId, ids)).orderBy(asc(s.productMedia.sort)),
    ]);
    const today = todayIST(app.deps.now());
    const [stock, fresh, stars] = await Promise.all([
      availability(
        db,
        variants.map((v) => v.id),
        today,
      ),
      nextBatches(
        db,
        variants.map((v) => v.id),
        today,
      ),
      ratings(db, ids),
    ]);
    return rows.map(({ p, c }) => {
      const vs = variants.filter((v) => v.productId === p.id);
      const gallery = media
        .filter((m) => m.productId === p.id && m.kind === 'image')
        .map((m) => {
          const { id: _id, ...img } = imageOut(storage, {
            id: m.id,
            width: m.width,
            height: m.height,
            variants: m.variants.length ? m.variants : [{ key: m.r2Key, width: m.width ?? 0, height: m.height ?? 0 }],
            alt: m.altEn,
          });
          return img;
        });
      return {
        row: p,
        variantsRaw: vs,
        gallery,
        summary: {
          id: p.id,
          slug: p.slug,
          name: language === 'hi' ? p.nameHi : p.nameEn,
          tagline: p.tagline,
          category: { slug: c.slug, name: language === 'hi' ? c.nameHi : c.nameEn },
          pack: p.pack,
          image: gallery[0] ?? null,
          isVeg: p.isVeg,
          featured: p.featured,
          attributes: p.attributes as Record<string, unknown>,
          fromPrice: money(vs.length ? Math.min(...vs.map((v) => v.pricePaise)) : 0),
          rating: stars.get(p.id) ?? null,
          variants: vs.map((v) => {
            const available = stock.get(v.id) ?? 0;
            return {
              id: v.id,
              sku: v.sku,
              packSize: v.packSize,
              price: money(v.pricePaise),
              mrp: money(v.mrpPaise),
              weightGrams: v.weightGrams,
              shelfLifeDays: v.shelfLifeDays,
              inStock: available > 0,
              lowStock: available > 0 && available <= v.lowStockThreshold,
              maxPerOrder: Math.max(0, Math.min(v.maxPerOrder, available)),
              unitPrice: (() => {
                const u = unitPrice(v.pricePaise, v.packSize);
                return u ? { amount: money(u.paise), per: u.per } : null;
              })(),
              nextBatch: (() => {
                const b = fresh.get(v.id);
                return b ? { manufacturedOn: b.manufacturedOn, bestBefore: b.expiresOn } : null;
              })(),
            };
          }),
        },
      };
    });
  }

  app.get(
    '/categories',
    {
      config: { auth: 'public' },
      schema: {
        tags: ['Catalog'],
        summary: 'Categories',
        response: {
          200: Type.Object({
            data: Type.Array(Type.Object({ id: Type.String(), slug: Type.String(), name: Type.String(), blurb: Type.String(), productCount: Type.Integer(), packs: Type.Array(PackSchema) })),
          }),
        },
      },
    },
    async (req, reply) => {
      const language = lang(req);
      const rows = await db.select().from(s.categories).orderBy(asc(s.categories.sort));
      const products = await db.select({ categoryId: s.products.categoryId, pack: s.products.pack }).from(s.products).where(eq(s.products.status, 'active')).orderBy(asc(s.products.sort));
      reply.header('cache-control', 'public, max-age=60, stale-while-revalidate=300');
      return {
        data: rows.map((c) => {
          const ps = products.filter((p) => p.categoryId === c.id);
          return { id: c.id, slug: c.slug, name: language === 'hi' ? c.nameHi : c.nameEn, blurb: c.blurb, productCount: ps.length, packs: ps.slice(0, 3).map((p) => p.pack) };
        }),
      };
    },
  );

  app.get(
    '/products',
    {
      config: { auth: 'public' },
      schema: {
        tags: ['Catalog'],
        summary: 'List and search products',
        querystring: Type.Object({
          category: Type.Optional(Type.String({ maxLength: 60 })),
          q: Type.Optional(Type.String({ maxLength: 100 })),
          featured: Type.Optional(Type.Boolean()),
          sort: Type.Optional(Type.Union([Type.Literal('featured'), Type.Literal('price_asc'), Type.Literal('price_desc')])),
          cursor: Type.Optional(Type.String()),
          limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 50 })),
        }),
        response: { 200: Type.Object({ data: Type.Array(ProductSummary), page: PageInfo }) },
      },
    },
    async (req, reply) => {
      const { category, q, featured, sort, cursor } = req.query;
      const limit = req.query.limit ?? 50;
      const where: SQL[] = [];
      if (category) where.push(eq(s.categories.slug, category));
      if (featured) where.push(eq(s.products.featured, true));
      if (q) {
        const tsq = prefixQuery(q);
        const doc = sql`to_tsvector('simple', ${s.products.nameEn} || ' ' || ${s.products.nameHi} || ' ' || ${s.products.searchTerms})`;
        where.push(sql`(${tsq ? sql`${doc} @@ to_tsquery('simple', ${tsq})` : sql`false`} OR similarity(${s.products.nameEn}, ${q}) > 0.3 OR ${s.products.searchTerms} ILIKE ${'%' + q + '%'})`);
      }
      let items = (await loadProducts(where, lang(req))).map((p) => p.summary);
      if (sort === 'price_asc') items = items.sort((a, b) => a.fromPrice.amount - b.fromPrice.amount);
      if (sort === 'price_desc') items = items.sort((a, b) => b.fromPrice.amount - a.fromPrice.amount);
      const offset = decodeCursor<{ o: number }>(cursor)?.o ?? 0;
      const page = items.slice(offset, offset + limit);
      const hasMore = offset + limit < items.length;
      reply.header('cache-control', 'public, max-age=30, stale-while-revalidate=120');
      return { data: page, page: { nextCursor: hasMore ? encodeCursor({ o: offset + limit }) : null, hasMore } };
    },
  );

  app.get(
    '/fresh',
    {
      config: { auth: 'public' },
      schema: {
        tags: ['Catalog'],
        summary: 'Fresh batches',
        description: 'Batches made in the last 21 days that are in stock, newest first.',
        response: {
          200: Type.Object({
            data: Type.Array(Type.Object({ product: ProductSummary, variantId: Type.String(), packSize: Type.String(), manufacturedOn: Type.String(), daysAgo: Type.Integer() })),
          }),
        },
      },
    },
    async (req, reply) => {
      const today = todayIST(app.deps.now());
      const rows = await db
        .select({ variantId: s.batches.variantId, made: s.batches.manufacturedOn, productId: s.productVariants.productId, packSize: s.productVariants.packSize })
        .from(s.batches)
        .innerJoin(s.productVariants, eq(s.productVariants.id, s.batches.variantId))
        .where(and(eq(s.batches.status, 'active'), gte(s.batches.manufacturedOn, addDays(today, -21)), sql`${s.batches.onHand} > ${s.batches.reserved}`, eq(s.productVariants.status, 'active')))
        .orderBy(desc(s.batches.manufacturedOn));
      // One entry per product: its newest batch.
      const seen = new Set<string>();
      const picks = rows.filter((r) => (seen.has(r.productId) ? false : (seen.add(r.productId), true))).slice(0, 8);
      if (!picks.length) return { data: [] };
      const products = await loadProducts(
        [
          inArray(
            s.products.id,
            picks.map((p) => p.productId),
          ),
        ],
        lang(req),
      );
      reply.header('cache-control', 'public, max-age=300, stale-while-revalidate=600');
      return {
        data: picks
          .map((p) => {
            const prod = products.find((x) => x.row.id === p.productId);
            return prod ? { product: prod.summary, variantId: p.variantId, packSize: p.packSize, manufacturedOn: p.made, daysAgo: daysBetween(p.made, today) } : null;
          })
          .filter((x): x is NonNullable<typeof x> => x !== null),
      };
    },
  );

  app.get(
    '/products/:slug',
    {
      config: { auth: 'public' },
      schema: {
        tags: ['Catalog'],
        summary: 'Product detail',
        params: Type.Object({ slug: Type.String({ maxLength: 80 }) }),
        response: { 200: ProductDetail, ...ErrorResponses },
      },
    },
    async (req, reply) => {
      const language = lang(req);
      const [found] = await loadProducts([eq(s.products.slug, req.params.slug)], language);
      if (!found) throw notFound('Product');
      const [seller] = await db.select({ fssai: s.sellers.fssaiNumber }).from(s.sellers).where(eq(s.sellers.id, found.row.sellerId));
      const related = (await loadProducts([eq(s.products.categoryId, found.row.categoryId)], language)).filter((p) => p.row.id !== found.row.id).slice(0, 4);
      const first = found.variantsRaw[0];
      reply.header('cache-control', 'public, max-age=30, stale-while-revalidate=120');
      return {
        ...found.summary,
        description: language === 'hi' && found.row.descriptionHi ? found.row.descriptionHi : found.row.descriptionEn,
        nutrition: found.row.nutrition,
        storage: first?.storage ?? 'ambient',
        hsnCode: first?.hsnCode ?? '',
        fssaiNumber: seller?.fssai ?? null,
        gallery: found.gallery,
        related: related.map((r) => r.summary),
      };
    },
  );
}
