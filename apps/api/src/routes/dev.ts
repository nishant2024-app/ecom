import { schema as s } from '@dairy/db';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import { and, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { notFound } from '../lib/errors';
import { requireAuth } from '../plugins/auth';
import { markPaid, markPaymentFailed } from '../services/orders';

/**
 * Development-only routes, registered only with the mock payment provider outside production.
 * The storefront's /checkout/pay/:id page uses this to stand in for Cashfree checkout.
 */
export default async function devRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<TypeBoxTypeProvider>();
  const { db } = app.deps.db;

  app.get(
    '/payments/:paymentId',
    { config: { auth: 'customer' }, schema: { tags: ['Dev'], summary: 'Mock payment details', params: Type.Object({ paymentId: Type.String() }) } },
    async (req) => {
      const [p] = await db.select().from(s.payments).where(and(eq(s.payments.id, req.params.paymentId), eq(s.payments.customerId, requireAuth(req).sub)));
      if (!p) throw notFound('Payment');
      const [o] = await db.select({ number: s.orders.number }).from(s.orders).where(eq(s.orders.id, p.orderId));
      return { id: p.id, orderId: p.orderId, orderNumber: o?.number, amount: { amount: p.amountPaise, currency: 'INR' }, status: p.status };
    },
  );

  app.post(
    '/payments/:paymentId/simulate',
    {
      config: { auth: 'customer' },
      schema: {
        tags: ['Dev'],
        summary: 'Complete a mock payment',
        params: Type.Object({ paymentId: Type.String() }),
        body: Type.Object({ outcome: Type.Union([Type.Literal('success'), Type.Literal('failed'), Type.Literal('user_dropped')]), method: Type.Optional(Type.String()) }),
      },
    },
    async (req) => {
      const [p] = await db.select().from(s.payments).where(and(eq(s.payments.id, req.params.paymentId), eq(s.payments.customerId, requireAuth(req).sub)));
      if (!p) throw notFound('Payment');
      const mock = app.deps.payments as unknown as { outcomes?: Map<string, { status: string }> };
      if (req.body.outcome === 'success') {
        mock.outcomes?.set(p.providerOrderId, { status: 'PAID' });
        await markPaid(app.deps, p.id, { providerPaymentId: `mock_${p.id}`, method: req.body.method ?? 'upi' });
      } else {
        await markPaymentFailed(app.deps, p.id, req.body.outcome);
      }
      return { orderId: p.orderId, outcome: req.body.outcome };
    },
  );
}
