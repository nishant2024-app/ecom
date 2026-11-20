import { schema as s } from '@dairy/db';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import { desc, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { audit } from '../../lib/audit';
import { notFound } from '../../lib/errors';
import { IdParam } from '../../lib/schemas';

const STATUS = Type.Union([Type.Literal('pending'), Type.Literal('approved'), Type.Literal('rejected')]);

export default async function adminReviewRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<TypeBoxTypeProvider>();
  const { db } = app.deps.db;

  app.get(
    '/reviews',
    { config: { auth: 'staff', permission: 'catalog.read' }, schema: { tags: ['Admin'], summary: 'Customer reviews to moderate', querystring: Type.Object({ status: Type.Optional(STATUS) }) } },
    async (req) => {
      const status = req.query.status ?? 'pending';
      const rows = await db
        .select({ r: s.productReviews, p: { name: s.products.nameEn, slug: s.products.slug }, c: { name: s.customers.name, email: s.customers.email }, o: { number: s.orders.number } })
        .from(s.productReviews)
        .innerJoin(s.products, eq(s.products.id, s.productReviews.productId))
        .innerJoin(s.customers, eq(s.customers.id, s.productReviews.customerId))
        .innerJoin(s.orders, eq(s.orders.id, s.productReviews.orderId))
        .where(eq(s.productReviews.status, status))
        .orderBy(desc(s.productReviews.updatedAt))
        .limit(200);
      const counts = await db.select({ status: s.productReviews.status }).from(s.productReviews);
      return {
        data: rows.map(({ r, p, c, o }) => ({ id: r.id, rating: r.rating, title: r.title, body: r.body, author: r.authorName, status: r.status, createdAt: r.createdAt.toISOString(), product: p, customer: c, orderNumber: o.number })),
        counts: { pending: counts.filter((x) => x.status === 'pending').length, approved: counts.filter((x) => x.status === 'approved').length, rejected: counts.filter((x) => x.status === 'rejected').length },
      };
    },
  );

  app.patch(
    '/reviews/:reviewId',
    {
      config: { auth: 'staff', permission: 'catalog.write' },
      schema: { tags: ['Admin'], summary: 'Approve or reject a review', params: IdParam('reviewId'), body: Type.Object({ status: STATUS }, { additionalProperties: false }) },
    },
    async (req) => {
      const [before] = await db.select().from(s.productReviews).where(eq(s.productReviews.id, req.params.reviewId));
      if (!before) throw notFound('Review');
      await db.update(s.productReviews).set({ status: req.body.status, updatedAt: new Date() }).where(eq(s.productReviews.id, before.id));
      await audit(db, req, `review.${req.body.status}`, 'review', before.id, { status: before.status }, { status: req.body.status });
      return { id: before.id, status: req.body.status };
    },
  );
}
