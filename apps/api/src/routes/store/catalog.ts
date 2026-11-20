import { addDays, openDates, todayIST } from '@dairy/core';
import { schema as s } from '@dairy/db';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import { and, asc, eq, inArray, sql, type SQL } from 'drizzle-orm';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { AppError, notFound } from '../../lib/errors';
import { BusinessDate, ErrorResponses, Money, Nullable, PageInfo, decodeCursor, encodeCursor, money } from '../../lib/schemas';
import { activeSlots, defaultSellerId, holidaySet, resolveZone, slotFirstOpenDate } from '../../services/store';

export const lang = (req: FastifyRequest): 'en' | 'hi' =>
  String(req.headers['accept-language'] ?? '').toLowerCase().startsWith('hi') ? 'hi' : 'en';

const Image = Type.Object({ url: Type.String(), alt: Type.String(), width: Type.Integer(), height: Type.Integer() });
const Variant = Type.Object({
  id: Type.String(),
  sku: Type.String(),
  packSize: Type.String(),
  price: Money,
  mrp: Money,
  subscriptionPrice: Nullable(Money),
  bottleDeposit: Money,
  subscribable: Type.Boolean(),
  available: Type.Boolean(),
});
const ProductSummary = Type.Object({
  id: Type.String(),
  slug: Type.String(),
  name: Type.String(),
  category: Type.Object({ slug: Type.String(), name: Type.String() }),
  image: Nullable(Image),
  isVeg: Type.Boolean(),
  attributes: Type.Record(Type.String(), Type.Unknown()),
  fromPrice: Money,
  variants: Type.Array(Variant),
});
const ProductDetail = Type.Intersect([
  ProductSummary,
  Type.Object({
    description: Type.String(),
    media: Type.Array(Type.Object({ id: Type.String(), kind: Type.String(), image: Nullable(Image) })),
    nutrition: Type.Array(Type.Object({ label: Type.String(), per100: Type.String() })),
    shelfLifeDays: Type.Integer(),
    storage: Type.String(),
    packaging: Type.String(),
    hsnCode: Type.String(),
    fssaiNumber: Nullable(Type.String()),
  }),
]);

/** Build a prefix tsquery from user text: "doo mil" → 'doo:* & mil:*'. */
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
  const mediaBase = app.deps.config.R2_PUBLIC_BASE_URL.replace(/\/$/, '');

  async function loadProducts(where: SQL[], zoneId: string | undefined, language: 'en' | 'hi') {
    const rows = await db
      .select({ p: s.products, c: s.categories })
      .from(s.products)
      .innerJoin(s.categories, eq(s.categories.id, s.products.categoryId))
      .where(and(eq(s.products.status, 'active'), ...where))
      .orderBy(asc(s.categories.sort), asc(s.products.sort), asc(s.products.id));
    if (rows.length === 0) return [];
    const ids = rows.map((r) => r.p.id);
    const variants = await db
      .select()
      .from(s.productVariants)
      .where(and(inArray(s.productVariants.productId, ids), eq(s.productVariants.status, 'active')))
      .orderBy(asc(s.productVariants.sort));
    const availability = zoneId
      ? await db
          .select()
          .from(s.zoneAvailability)
          .where(and(eq(s.zoneAvailability.zoneId, zoneId), inArray(s.zoneAvailability.variantId, variants.map((v) => v.id))))
      : [];
    const availableIds = new Set(availability.filter((a) => a.available).map((a) => a.variantId));
    const media = await db.select().from(s.productMedia).where(inArray(s.productMedia.productId, ids)).orderBy(asc(s.productMedia.sort));

    return rows.map(({ p, c }) => {
      const vs = variants.filter((v) => v.productId === p.id);
      const pm = media.filter((m) => m.productId === p.id);
      const img = pm.find((m) => m.kind === 'image');
      return {
        row: p,
        variantsRaw: vs,
        mediaRaw: pm,
        summary: {
          id: p.id,
          slug: p.slug,
          name: language === 'hi' ? p.nameHi : p.nameEn,
          category: { slug: c.slug, name: language === 'hi' ? c.nameHi : c.nameEn },
          image: img
            ? { url: `${mediaBase}/${img.r2Key}`, alt: language === 'hi' ? img.altHi : img.altEn, width: img.width ?? 0, height: img.height ?? 0 }
            : null,
          isVeg: p.isVeg,
          attributes: p.attributes as Record<string, unknown>,
          fromPrice: money(Math.min(...vs.map((v) => v.pricePaise), Number.MAX_SAFE_INTEGER) === Number.MAX_SAFE_INTEGER ? 0 : Math.min(...vs.map((v) => v.pricePaise))),
          variants: vs.map((v) => ({
            id: v.id,
            sku: v.sku,
            packSize: v.packSize,
            price: money(v.pricePaise),
            mrp: money(v.mrpPaise),
            subscriptionPrice: v.subscriptionPricePaise === null ? null : money(v.subscriptionPricePaise),
            bottleDeposit: money(v.bottleDepositPaise),
            subscribable: v.subscribable,
            available: zoneId ? availableIds.has(v.id) : true,
          })),
        },
      };
    });
  }

  app.get(
    '/serviceability',
    {
      config: { auth: 'public' },
      schema: {
        tags: ['Catalog'],
        summary: 'Check if a pincode or location is served',
        querystring: Type.Object({
          pincode: Type.Optional(Type.String({ pattern: '^[1-9][0-9]{5}$' })),
          lat: Type.Optional(Type.Number({ minimum: -90, maximum: 90 })),
          lng: Type.Optional(Type.Number({ minimum: -180, maximum: 180 })),
        }),
        response: {
          200: Type.Object({
            serviceable: Type.Boolean(),
            needsPin: Type.Boolean(),
            zone: Nullable(Type.Object({ id: Type.String(), name: Type.String() })),
            slots: Type.Array(
              Type.Object({ id: Type.String(), code: Type.String(), label: Type.String(), nextDeliveryDate: Type.String(), cutoffAt: Type.String() }),
            ),
          }),
          ...ErrorResponses,
        },
      },
    },
    async (req) => {
      const { pincode, lat, lng } = req.query;
      if (!pincode && (lat === undefined || lng === undefined)) throw new AppError('VALIDATION_FAILED', 400, 'Provide a pincode or lat and lng');
      const location = lat !== undefined && lng !== undefined ? { lat, lng } : null;
      const zone = await resolveZone(db, { pincode, location });
      if (!zone.zoneId) return { serviceable: false, needsPin: zone.needsPin, zone: null, slots: [] };
      const sellerId = await defaultSellerId(db);
      const now = app.deps.now();
      const language = lang(req);
      const slots = await Promise.all(
        (await activeSlots(db, sellerId)).map(async (slot) => {
          const next = await slotFirstOpenDate(db, slot, now);
          const cutoff = openDates(slot.timing, next, 1, now)[0]!.cutoffAt;
          return { id: slot.id, code: slot.code, label: language === 'hi' ? slot.labelHi : slot.labelEn, nextDeliveryDate: next, cutoffAt: cutoff.toISOString() };
        }),
      );
      return { serviceable: true, needsPin: false, zone: { id: zone.zoneId, name: zone.zoneName! }, slots };
    },
  );

  app.get(
    '/categories',
    {
      config: { auth: 'public' },
      schema: {
        tags: ['Catalog'],
        summary: 'Category list',
        response: { 200: Type.Object({ data: Type.Array(Type.Object({ id: Type.String(), slug: Type.String(), name: Type.String() })) }) },
      },
    },
    async (req, reply) => {
      const language = lang(req);
      const rows = await db.select().from(s.categories).orderBy(asc(s.categories.sort));
      reply.header('cache-control', 'public, max-age=60, stale-while-revalidate=300');
      return { data: rows.map((c) => ({ id: c.id, slug: c.slug, name: language === 'hi' ? c.nameHi : c.nameEn })) };
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
          zoneId: Type.Optional(Type.String()),
          category: Type.Optional(Type.String({ maxLength: 60 })),
          q: Type.Optional(Type.String({ maxLength: 100 })),
          subscribable: Type.Optional(Type.Boolean()),
          cursor: Type.Optional(Type.String()),
          limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 50 })),
        }),
        response: { 200: Type.Object({ data: Type.Array(ProductSummary), page: PageInfo }) },
      },
    },
    async (req, reply) => {
      const { zoneId, category, q, subscribable, cursor } = req.query;
      const limit = req.query.limit ?? 50;
      const where: SQL[] = [];
      if (category) where.push(eq(s.categories.slug, category));
      if (q) {
        const tsq = prefixQuery(q);
        const doc = sql`to_tsvector('simple', ${s.products.nameEn} || ' ' || ${s.products.nameHi} || ' ' || ${s.products.searchTerms})`;
        where.push(
          sql`(${tsq ? sql`${doc} @@ to_tsquery('simple', ${tsq})` : sql`false`} OR similarity(${s.products.nameEn}, ${q}) > 0.3 OR ${s.products.searchTerms} ILIKE ${'%' + q + '%'})`,
        );
      }
      let items = (await loadProducts(where, zoneId, lang(req))).map((p) => p.summary);
      if (subscribable) items = items.filter((p) => p.variants.some((v) => v.subscribable));
      if (zoneId) items = items.filter((p) => p.variants.some((v) => v.available));
      const offset = decodeCursor<{ o: number }>(cursor)?.o ?? 0;
      const page = items.slice(offset, offset + limit);
      const hasMore = offset + limit < items.length;
      reply.header('cache-control', 'public, max-age=60, stale-while-revalidate=300');
      return { data: page, page: { nextCursor: hasMore ? encodeCursor({ o: offset + limit }) : null, hasMore } };
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
        querystring: Type.Object({ zoneId: Type.Optional(Type.String()) }),
        response: { 200: ProductDetail, ...ErrorResponses },
      },
    },
    async (req, reply) => {
      const language = lang(req);
      const [found] = await loadProducts([eq(s.products.slug, req.params.slug)], req.query.zoneId, language);
      if (!found) throw notFound('Product');
      const [seller] = await db.select({ fssai: s.sellers.fssaiNumber }).from(s.sellers).where(eq(s.sellers.id, found.row.sellerId));
      const first = found.variantsRaw[0];
      reply.header('cache-control', 'public, max-age=60, stale-while-revalidate=300');
      return {
        ...found.summary,
        description: language === 'hi' && found.row.descriptionHi ? found.row.descriptionHi : found.row.descriptionEn,
        media: found.mediaRaw.map((m) => ({
          id: m.id,
          kind: m.kind,
          image: m.kind === 'image' ? { url: `${mediaBase}/${m.r2Key}`, alt: language === 'hi' ? m.altHi : m.altEn, width: m.width ?? 0, height: m.height ?? 0 } : null,
        })),
        nutrition: found.row.nutrition,
        shelfLifeDays: first?.shelfLifeDays ?? 0,
        storage: first?.storage ?? 'chilled',
        packaging: first?.packaging ?? 'pouch',
        hsnCode: first?.hsnCode ?? '',
        fssaiNumber: seller?.fssai ?? null,
      };
    },
  );

  app.get(
    '/delivery-slots',
    {
      config: { auth: 'public' },
      schema: {
        tags: ['Catalog'],
        summary: 'Slots with open dates and cutoffs',
        querystring: Type.Object({
          zoneId: Type.String(),
          from: Type.Optional(BusinessDate),
          days: Type.Optional(Type.Integer({ minimum: 1, maximum: 31, default: 14 })),
        }),
        response: {
          200: Type.Object({
            data: Type.Array(
              Type.Object({
                id: Type.String(),
                code: Type.String(),
                label: Type.String(),
                dates: Type.Array(Type.Object({ date: Type.String(), cutoffAt: Type.String(), open: Type.Boolean() })),
              }),
            ),
          }),
        },
      },
    },
    async (req) => {
      const now = app.deps.now();
      const from = req.query.from ?? todayIST(now);
      const days = req.query.days ?? 14;
      const sellerId = await defaultSellerId(db);
      const language = lang(req);
      const slots = await activeSlots(db, sellerId);
      return {
        data: await Promise.all(
          slots.map(async (slot) => {
            const holidays = await holidaySet(db, sellerId, slot.id, from, addDays(from, days));
            return {
              id: slot.id,
              code: slot.code,
              label: language === 'hi' ? slot.labelHi : slot.labelEn,
              dates: openDates(slot.timing, from, days, now, holidays).map((d) => ({ ...d, cutoffAt: d.cutoffAt.toISOString() })),
            };
          }),
        ),
      };
    },
  );
}
