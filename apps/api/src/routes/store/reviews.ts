import { newId } from '@dairy/core';
import { schema as s } from '@dairy/db';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import { and, desc, eq, lt, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { AppError, notFound } from '../../lib/errors';
import { ErrorResponses, Nullable, PageInfo, decodeCursor, encodeCursor } from '../../lib/schemas';
import { requireAuth } from '../../plugins/auth';
import { deliveredOrderFor, publicName } from '../../services/reviews';

const Review = Type.Object({ id: Type.String(), rating: Type.Integer(), title: Type.String(), body: Type.String(), author: Type.String(), verified: Type.Boolean(), createdAt: Type.String() });
const Slug = Type.Object({ slug: Type.String({ maxLength: 80 }) });

export default async function reviewRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<TypeBoxTypeProvider>();
  const { db } = app.deps.db;

  async function productBySlug(slug: string) {
    const [p] = await db
      .select({ id: s.products.id })
      .from(s.products)
      .where(and(eq(s.products.slug, slug), eq(s.products.status, 'active')));
    if (!p) throw notFound('Product');
    return p.id;
  }

  app.get(
    '/products/:slug/reviews',
    {
      config: { auth: 'public' },
      schema: {
        tags: ['Catalog'],
        summary: 'Product reviews',
        description: 'Approved reviews with the rating breakdown. Every review comes from a delivered order.',
        params: Slug,
        querystring: Type.Object({ cursor: Type.Optional(Type.String()), limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 50, default: 10 })) }),
        response: {
          200: Type.Object({
            summary: Type.Object({ average: Type.Number(), count: Type.Integer(), breakdown: Type.Record(Type.String(), Type.Integer()) }),
            data: Type.Array(Review),
            page: PageInfo,
          }),
          ...ErrorResponses,
        },
      },
    },
    async (req, reply) => {
      const productId = await productBySlug(req.params.slug);
      const limit = req.query.limit ?? 10;
      const before = decodeCursor<{ id: string }>(req.query.cursor)?.id;
      const approved = and(eq(s.productReviews.productId, productId), eq(s.productReviews.status, 'approved'));
      const [rows, dist] = await Promise.all([
        db
          .select()
          .from(s.productReviews)
          .where(and(approved, ...(before ? [lt(s.productReviews.id, before)] : [])))
          .orderBy(desc(s.productReviews.id))
          .limit(limit + 1),
        db
          .select({ rating: s.productReviews.rating, n: sql<number>`count(*)::int` })
          .from(s.productReviews)
          .where(approved)
          .groupBy(s.productReviews.rating),
      ]);
      const count = dist.reduce((a, d) => a + Number(d.n), 0);
      const sum = dist.reduce((a, d) => a + d.rating * Number(d.n), 0);
      const page = rows.slice(0, limit);
      reply.header('cache-control', 'public, max-age=60, stale-while-revalidate=300');
      return {
        summary: {
          average: count ? Math.round((sum / count) * 10) / 10 : 0,
          count,
          breakdown: Object.fromEntries([5, 4, 3, 2, 1].map((r) => [String(r), Number(dist.find((d) => d.rating === r)?.n ?? 0)])),
        },
        data: page.map((r) => ({ id: r.id, rating: r.rating, title: r.title, body: r.body, author: r.authorName, verified: true, createdAt: r.createdAt.toISOString() })),
        page: { nextCursor: rows.length > limit ? encodeCursor({ id: page.at(-1)!.id }) : null, hasMore: rows.length > limit },
      };
    },
  );

  app.get(
    '/products/:slug/reviews/mine',
    {
      config: { auth: 'customer' },
      schema: {
        tags: ['Catalog'],
        summary: 'My review status',
        description: 'Whether I can review this product (needs a delivered order) and my existing review.',
        params: Slug,
        response: {
          200: Type.Object({ eligible: Type.Boolean(), review: Nullable(Type.Object({ rating: Type.Integer(), title: Type.String(), body: Type.String(), status: Type.String() })) }),
          ...ErrorResponses,
        },
      },
    },
    async (req) => {
      const customerId = requireAuth(req).sub;
      const productId = await productBySlug(req.params.slug);
      const [mine] = await db
        .select()
        .from(s.productReviews)
        .where(and(eq(s.productReviews.productId, productId), eq(s.productReviews.customerId, customerId)));
      const orderId = await deliveredOrderFor(db, customerId, productId);
      return { eligible: !!orderId, review: mine ? { rating: mine.rating, title: mine.title, body: mine.body, status: mine.status } : null };
    },
  );

  app.put(
    '/products/:slug/reviews/mine',
    {
      config: { auth: 'customer' },
      schema: {
        tags: ['Catalog'],
        summary: 'Write or edit my review',
        description: 'Only possible after a delivered order. The review shows after staff approve it.',
        params: Slug,
        body: Type.Object(
          { rating: Type.Integer({ minimum: 1, maximum: 5 }), title: Type.Optional(Type.String({ maxLength: 80 })), body: Type.Optional(Type.String({ maxLength: 2000 })) },
          { additionalProperties: false },
        ),
        response: { 200: Type.Object({ status: Type.String() }), ...ErrorResponses },
      },
    },
    async (req) => {
      const customerId = requireAuth(req).sub;
      const productId = await productBySlug(req.params.slug);
      const orderId = await deliveredOrderFor(db, customerId, productId);
      if (!orderId) throw new AppError('REVIEW_NOT_ALLOWED', 403, 'You can review a product after an order with it has been delivered');
      const [customer] = await db.select({ name: s.customers.name }).from(s.customers).where(eq(s.customers.id, customerId));
      const values = {
        rating: req.body.rating,
        title: (req.body.title ?? '').trim(),
        body: (req.body.body ?? '').trim(),
        status: 'pending',
        orderId,
        authorName: publicName(customer?.name ?? 'Customer'),
      };
      await db
        .insert(s.productReviews)
        .values({ id: newId('rvw'), productId, customerId, ...values })
        .onConflictDoUpdate({ target: [s.productReviews.productId, s.productReviews.customerId], set: { ...values, updatedAt: new Date() } });
      return { status: 'pending' };
    },
  );

  app.get(
    '/verify/:code',
    {
      config: { auth: 'public', rateLimit: { max: 20, timeWindow: '1 minute' } },
      schema: {
        tags: ['Catalog'],
        summary: 'Verify a batch code',
        description: 'Check a batch code printed on a pack: genuine or not, with its dates.',
        params: Type.Object({ code: Type.String({ minLength: 3, maxLength: 40 }) }),
        response: {
          200: Type.Object({
            genuine: Type.Literal(true),
            code: Type.String(),
            product: Type.Object({ name: Type.String(), slug: Type.String(), packSize: Type.String() }),
            manufacturedOn: Type.String(),
            bestBefore: Type.String(),
            expired: Type.Boolean(),
          }),
          ...ErrorResponses,
        },
      },
    },
    async (req) => {
      const code = req.params.code.trim().toUpperCase();
      const [row] = await db
        .select({ b: s.batches, v: s.productVariants, p: s.products })
        .from(s.batches)
        .innerJoin(s.productVariants, eq(s.productVariants.id, s.batches.variantId))
        .innerJoin(s.products, eq(s.products.id, s.productVariants.productId))
        .where(sql`upper(${s.batches.code}) = ${code}`)
        .limit(1);
      if (!row) throw new AppError('BATCH_NOT_FOUND', 404, 'We could not find this batch code. Check it on the pack, or contact us with a photo of the label.');
      const today = new Date().toISOString().slice(0, 10);
      return {
        genuine: true as const,
        code: row.b.code,
        product: { name: row.p.nameEn, slug: row.p.slug, packSize: row.v.packSize },
        manufacturedOn: row.b.manufacturedOn,
        bestBefore: row.b.expiresOn,
        expired: row.b.expiresOn < today,
      };
    },
  );
}
