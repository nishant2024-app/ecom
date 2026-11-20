import { customerCanCancel, type OrderStatus } from '@dairy/core';
import { schema as s } from '@dairy/db';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import { and, desc, eq, lt } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { AppError, notFound } from '../../lib/errors';
import { CursorQuery, IdParam, PageInfo, decodeCursor, encodeCursor, money } from '../../lib/schemas';
import { requireAuth } from '../../plugins/auth';
import { cancelOrder, orderSummaries, orderView, placeOrder, retryPayment } from '../../services/orders';
import { CartLines } from './checkout';

export default async function orderRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<TypeBoxTypeProvider>();
  const { db } = app.deps.db;
  const cfg = { auth: 'customer' as const };

  const paymentOut = (paymentId: string, sessionId: string | null | undefined) => ({
    id: paymentId,
    provider: app.deps.payments.name,
    environment: app.deps.payments.environment,
    paymentSessionId: sessionId ?? null,
    // The mock provider completes payments on the storefront's test page instead of Cashfree checkout.
    mockCheckoutPath: app.deps.payments.name === 'mock' ? `/checkout/pay/${paymentId}` : null,
  });

  async function owned(customerId: string, orderId: string) {
    const view = await orderView(db, orderId);
    if (view.customerId !== customerId) throw notFound('Order');
    const { customerId: _omit, ...rest } = view;
    return rest;
  }

  app.post(
    '/orders',
    {
      config: { ...cfg, idempotent: true, rateLimit: { max: 10, timeWindow: '1 minute' } },
      schema: {
        tags: ['Orders'],
        summary: 'Place an order and start payment',
        body: Type.Object({ lines: CartLines, addressId: Type.String(), note: Type.Optional(Type.String({ maxLength: 300 })) }, { additionalProperties: false }),
      },
    },
    async (req, reply) => {
      const customerId = requireAuth(req).sub;
      const { orderId, paymentId } = await placeOrder(app.deps, { customerId, ...req.body });
      const order = await owned(customerId, orderId);
      return reply.status(201).send({ order, payment: paymentOut(paymentId, order.payment?.paymentSessionId) });
    },
  );

  app.get(
    '/orders',
    {
      config: cfg,
      schema: { tags: ['Orders'], summary: 'My orders', querystring: CursorQuery, response: { 200: Type.Object({ data: Type.Array(Type.Any()), page: PageInfo }) } },
    },
    async (req) => {
      const customerId = requireAuth(req).sub;
      const limit = req.query.limit ?? 20;
      const before = decodeCursor<{ id: string }>(req.query.cursor)?.id;
      const rows = await db
        .select()
        .from(s.orders)
        .where(and(eq(s.orders.customerId, customerId), ...(before ? [lt(s.orders.id, before)] : [])))
        .orderBy(desc(s.orders.id))
        .limit(limit + 1);
      const page = rows.slice(0, limit);
      const summaries = await orderSummaries(db, page.map((o) => o.id));
      return {
        data: page.map((o) => ({
          id: o.id,
          number: o.number,
          status: o.status,
          placedAt: o.createdAt.toISOString(),
          total: money(o.totalPaise),
          itemCount: summaries.get(o.id)?.count ?? 0,
          firstItem: summaries.get(o.id)?.firstName ?? '',
          packs: summaries.get(o.id)?.packs ?? [],
          trackingNumber: o.trackingNumber,
          courier: o.courier,
        })),
        page: { nextCursor: rows.length > limit ? encodeCursor({ id: page.at(-1)!.id }) : null, hasMore: rows.length > limit },
      };
    },
  );

  app.get(
    '/orders/:orderId',
    { config: cfg, schema: { tags: ['Orders'], summary: 'Order detail with timeline', params: IdParam('orderId') } },
    async (req) => {
      const order = await owned(requireAuth(req).sub, req.params.orderId);
      return {
        ...order,
        canCancel: customerCanCancel(order.status as OrderStatus),
        payment: order.payment ? { ...order.payment, ...(order.payment.paymentSessionId ? paymentOut(order.payment.id, order.payment.paymentSessionId) : {}) } : null,
      };
    },
  );

  app.post(
    '/orders/:orderId/pay',
    {
      config: { ...cfg, rateLimit: { max: 10, timeWindow: '1 minute' } },
      schema: { tags: ['Orders'], summary: 'Start a new payment attempt for an unpaid order', params: IdParam('orderId') },
    },
    async (req) => {
      const customerId = requireAuth(req).sub;
      const paymentId = await retryPayment(app.deps, req.params.orderId, customerId);
      const [p] = await db.select().from(s.payments).where(eq(s.payments.id, paymentId));
      return { payment: paymentOut(paymentId, p?.paymentSessionId) };
    },
  );

  app.post(
    '/orders/:orderId/cancel',
    {
      config: cfg,
      schema: {
        tags: ['Orders'],
        summary: 'Cancel before packing (refunds automatically)',
        params: IdParam('orderId'),
        body: Type.Optional(Type.Object({ reason: Type.Optional(Type.String({ maxLength: 200 })) }, { additionalProperties: false })),
      },
    },
    async (req) => {
      const customerId = requireAuth(req).sub;
      const order = await owned(customerId, req.params.orderId);
      if (!customerCanCancel(order.status as OrderStatus)) {
        throw new AppError('CONFLICT', 409, 'This order has already been packed. Contact support to return it.');
      }
      await cancelOrder(app.deps, order.id, req.body?.reason?.trim() || 'Cancelled by customer', { type: 'customer', id: customerId });
      return owned(customerId, order.id);
    },
  );
}
