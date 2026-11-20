import { newId, todayIST } from '@dairy/core';
import { schema as s } from '@dairy/db';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import { and, asc, eq, ilike, inArray, ne, notInArray, or, type SQL } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { audit } from '../../lib/audit';
import { AppError, forbidden, notFound } from '../../lib/errors';
import { hasPermission } from '../../lib/permissions';
import { IdParam, money } from '../../lib/schemas';
import { availability } from '../../services/stock';
import { defaultSellerId } from '../../services/store';

const Pack = Type.Object({
  kind: Type.Union(['jar', 'tin', 'tetra', 'can', 'box', 'pouch'].map((k) => Type.Literal(k))),
  color: Type.String({ pattern: '^#[0-9A-Fa-f]{6}$' }),
  accent: Type.String({ pattern: '^#[0-9A-Fa-f]{6}$' }),
});
const VariantInput = Type.Object(
  {
    id: Type.Optional(Type.String()),
    sku: Type.String({ minLength: 2, maxLength: 40, pattern: '^[A-Z0-9-]+$' }),
    packSize: Type.String({ minLength: 1, maxLength: 40 }),
    pricePaise: Type.Integer({ minimum: 100 }),
    mrpPaise: Type.Integer({ minimum: 100 }),
    weightGrams: Type.Integer({ minimum: 1, maximum: 50_000 }),
    hsnCode: Type.String({ pattern: '^[0-9]{4,8}$' }),
    gstRateBps: Type.Integer({ minimum: 0, maximum: 2800 }),
    shelfLifeDays: Type.Integer({ minimum: 1, maximum: 1095 }),
    storage: Type.Optional(Type.Union([Type.Literal('ambient'), Type.Literal('cool_dry'), Type.Literal('chilled')])),
    lowStockThreshold: Type.Optional(Type.Integer({ minimum: 0, maximum: 10_000 })),
    maxPerOrder: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
  },
  { additionalProperties: false },
);
const ProductInput = Type.Object(
  {
    slug: Type.String({ minLength: 2, maxLength: 80, pattern: '^[a-z0-9-]+$' }),
    categoryId: Type.String(),
    nameEn: Type.String({ minLength: 2, maxLength: 80 }),
    nameHi: Type.String({ minLength: 1, maxLength: 80 }),
    tagline: Type.Optional(Type.String({ maxLength: 120 })),
    descriptionEn: Type.Optional(Type.String({ maxLength: 4000 })),
    descriptionHi: Type.Optional(Type.String({ maxLength: 4000 })),
    searchTerms: Type.Optional(Type.String({ maxLength: 300 })),
    attributes: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
    nutrition: Type.Optional(Type.Array(Type.Object({ label: Type.String({ maxLength: 40 }), per100: Type.String({ maxLength: 40 }) }), { maxItems: 20 })),
    pack: Type.Optional(Pack),
    featured: Type.Optional(Type.Boolean()),
    status: Type.Optional(Type.Union([Type.Literal('draft'), Type.Literal('active'), Type.Literal('archived')])),
    variants: Type.Array(VariantInput, { minItems: 1, maxItems: 12 }),
  },
  { additionalProperties: false },
);

export default async function adminCatalogRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<TypeBoxTypeProvider>();
  const { db } = app.deps.db;

  async function productOut(id: string) {
    const [p] = await db.select().from(s.products).where(eq(s.products.id, id));
    if (!p) throw notFound('Product');
    const variants = await db.select().from(s.productVariants).where(eq(s.productVariants.productId, id)).orderBy(asc(s.productVariants.sort));
    const stock = await availability(db, variants.map((v) => v.id), todayIST(app.deps.now()));
    return { ...p, variants: variants.map((v) => ({ ...v, available: stock.get(v.id) ?? 0 })) };
  }

  app.get('/categories', { config: { auth: 'staff', permission: 'catalog.read' }, schema: { tags: ['Admin'], summary: 'Categories' } }, async () => ({
    data: await db.select().from(s.categories).orderBy(asc(s.categories.sort)),
  }));

  app.get(
    '/products',
    {
      config: { auth: 'staff', permission: 'catalog.read' },
      schema: { tags: ['Admin'], summary: 'Products with variants and stock', querystring: Type.Object({ q: Type.Optional(Type.String()), status: Type.Optional(Type.String()), category: Type.Optional(Type.String()) }) },
    },
    async (req) => {
      const where: SQL[] = [];
      if (req.query.status) where.push(eq(s.products.status, req.query.status));
      if (req.query.category) where.push(eq(s.products.categoryId, req.query.category));
      if (req.query.q) where.push(or(ilike(s.products.nameEn, `%${req.query.q}%`), ilike(s.products.slug, `%${req.query.q}%`))!);
      const rows = await db.select({ p: s.products, c: s.categories }).from(s.products).innerJoin(s.categories, eq(s.categories.id, s.products.categoryId)).where(and(...where)).orderBy(asc(s.categories.sort), asc(s.products.sort));
      const variants = rows.length ? await db.select().from(s.productVariants).where(inArray(s.productVariants.productId, rows.map((r) => r.p.id))).orderBy(asc(s.productVariants.sort)) : [];
      const stock = await availability(db, variants.map((v) => v.id), todayIST(app.deps.now()));
      return {
        data: rows.map(({ p, c }) => ({
          id: p.id,
          slug: p.slug,
          name: p.nameEn,
          category: c.nameEn,
          status: p.status,
          featured: p.featured,
          pack: p.pack,
          variants: variants
            .filter((v) => v.productId === p.id)
            .map((v) => ({ id: v.id, sku: v.sku, packSize: v.packSize, price: money(v.pricePaise), mrp: money(v.mrpPaise), status: v.status, available: stock.get(v.id) ?? 0, lowStockThreshold: v.lowStockThreshold })),
        })),
      };
    },
  );

  app.get('/products/:productId', { config: { auth: 'staff', permission: 'catalog.read' }, schema: { tags: ['Admin'], summary: 'Product', params: IdParam('productId') } }, async (req) => productOut(req.params.productId));

  async function checkPricing(req: Parameters<typeof audit>[1], variants: typeof VariantInput.static[], existing: (typeof s.productVariants.$inferSelect)[]) {
    for (const v of variants) {
      if (v.pricePaise > v.mrpPaise) throw new AppError('VALIDATION_FAILED', 400, `Price of ${v.sku} is above its MRP`);
      const old = existing.find((e) => e.id === v.id);
      const priceChanged = !old || old.pricePaise !== v.pricePaise || old.mrpPaise !== v.mrpPaise;
      if (old && priceChanged && !hasPermission(req.auth?.role, 'pricing.write')) throw forbidden('Changing prices requires permission pricing.write');
    }
  }

  async function assertUnique(slug: string, skus: string[], productId?: string) {
    const [slugClash] = await db.select({ id: s.products.id }).from(s.products).where(and(eq(s.products.slug, slug), ...(productId ? [ne(s.products.id, productId)] : [])));
    if (slugClash) throw new AppError('CONFLICT', 409, `Slug ${slug} is already used`);
    if (new Set(skus).size !== skus.length) throw new AppError('VALIDATION_FAILED', 400, 'Each variant needs a different SKU');
    const skuClash = await db.select({ sku: s.productVariants.sku }).from(s.productVariants).where(and(inArray(s.productVariants.sku, skus), ...(productId ? [ne(s.productVariants.productId, productId)] : [])));
    if (skuClash.length) throw new AppError('CONFLICT', 409, `SKU ${skuClash[0]!.sku} is already used`);
  }

  const variantValues = (v: typeof VariantInput.static, i: number) => ({
    sku: v.sku,
    packSize: v.packSize,
    pricePaise: v.pricePaise,
    mrpPaise: v.mrpPaise,
    weightGrams: v.weightGrams,
    hsnCode: v.hsnCode,
    gstRateBps: v.gstRateBps,
    shelfLifeDays: v.shelfLifeDays,
    storage: v.storage ?? 'ambient',
    lowStockThreshold: v.lowStockThreshold ?? 20,
    maxPerOrder: v.maxPerOrder ?? 10,
    sort: i,
    status: 'active',
  });

  app.post(
    '/products',
    { config: { auth: 'staff', permission: 'catalog.write' }, schema: { tags: ['Admin'], summary: 'Create a product with variants', body: ProductInput } },
    async (req, reply) => {
      const b = req.body;
      await checkPricing(req, b.variants, []);
      await assertUnique(b.slug, b.variants.map((v) => v.sku));
      const sellerId = await defaultSellerId(db);
      const id = newId('prd');
      await db.transaction(async (tx) => {
        await tx.insert(s.products).values({
          id,
          sellerId,
          categoryId: b.categoryId,
          slug: b.slug,
          nameEn: b.nameEn,
          nameHi: b.nameHi,
          tagline: b.tagline ?? '',
          descriptionEn: b.descriptionEn ?? '',
          descriptionHi: b.descriptionHi ?? '',
          searchTerms: b.searchTerms ?? '',
          attributes: b.attributes ?? {},
          nutrition: b.nutrition ?? [],
          ...(b.pack ? { pack: b.pack as s.PackVisual } : {}),
          featured: b.featured ?? false,
          status: b.status ?? 'draft',
        });
        await tx.insert(s.productVariants).values(b.variants.map((v, i) => ({ id: newId('var'), productId: id, sellerId, ...variantValues(v, i) })));
      });
      const out = await productOut(id);
      await audit(db, req, 'product.create', 'product', id, null, out);
      return reply.status(201).send(out);
    },
  );

  app.put(
    '/products/:productId',
    { config: { auth: 'staff', permission: 'catalog.write' }, schema: { tags: ['Admin'], summary: 'Update a product; variants not listed are archived', params: IdParam('productId'), body: ProductInput } },
    async (req) => {
      const before = await productOut(req.params.productId);
      const b = req.body;
      await checkPricing(req, b.variants, before.variants);
      await assertUnique(b.slug, b.variants.map((v) => v.sku), before.id);
      await db.transaction(async (tx) => {
        await tx
          .update(s.products)
          .set({
            categoryId: b.categoryId,
            slug: b.slug,
            nameEn: b.nameEn,
            nameHi: b.nameHi,
            tagline: b.tagline ?? '',
            descriptionEn: b.descriptionEn ?? '',
            descriptionHi: b.descriptionHi ?? '',
            searchTerms: b.searchTerms ?? '',
            attributes: b.attributes ?? {},
            nutrition: b.nutrition ?? [],
            ...(b.pack ? { pack: b.pack as s.PackVisual } : {}),
            featured: b.featured ?? false,
            status: b.status ?? before.status,
          })
          .where(eq(s.products.id, before.id));
        const keep: string[] = [];
        for (const [i, v] of b.variants.entries()) {
          if (v.id && before.variants.some((x) => x.id === v.id)) {
            await tx.update(s.productVariants).set(variantValues(v, i)).where(eq(s.productVariants.id, v.id));
            keep.push(v.id);
          } else {
            const id = newId('var');
            await tx.insert(s.productVariants).values({ id, productId: before.id, sellerId: before.sellerId, ...variantValues(v, i) });
            keep.push(id);
          }
        }
        await tx
          .update(s.productVariants)
          .set({ status: 'archived' })
          .where(and(eq(s.productVariants.productId, before.id), notInArray(s.productVariants.id, keep)));
      });
      const after = await productOut(before.id);
      await audit(db, req, 'product.update', 'product', before.id, before, after);
      return after;
    },
  );
}
