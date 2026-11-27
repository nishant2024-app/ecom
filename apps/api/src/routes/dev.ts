import { schema as s } from '@dairy/db';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import { and, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { newId } from '@dairy/core';
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

  /** Sign in as a test customer without Google (AUTH_TEST_MODE only; never in production). */
  if (app.deps.config.AUTH_TEST_MODE) {
    app.post(
      '/sign-in',
      {
        config: { auth: 'public', csrf: false },
        schema: {
          tags: ['Dev'],
          summary: 'Test-customer sign-in',
          body: Type.Object({
            email: Type.String({ format: 'email' }),
            name: Type.Optional(Type.String({ maxLength: 80 })),
            client: Type.Optional(Type.Union([Type.Literal('web'), Type.Literal('android')])),
          }),
        },
      },
      async (req, reply) => {
        const email = req.body.email.toLowerCase();
        const subject = `dev:${email}`;
        let [identity] = await db
          .select()
          .from(s.authIdentities)
          .where(and(eq(s.authIdentities.provider, 'dev'), eq(s.authIdentities.subject, subject)));
        if (!identity) {
          const id = newId('cus');
          await db.insert(s.customers).values({ id, name: req.body.name ?? email.split('@')[0]!, email });
          [identity] = await db
            .insert(s.authIdentities)
            .values({ id: newId('idn'), userType: 'customer', userId: id, provider: 'dev', subject, email })
            .returning();
        }
        const out = await app.deps.issueSession!(req, reply, { type: 'customer', id: identity!.userId }, req.body.client ?? 'web', 'Test sign-in');
        return { customerId: identity!.userId, ...out };
      },
    );
  }

  /** Sign in as an existing staff member without Google (AUTH_TEST_MODE only; never in production). */
  if (app.deps.config.AUTH_TEST_MODE) {
    app.post(
      '/staff-sign-in',
      {
        config: { auth: 'public', csrf: false },
        schema: { tags: ['Dev'], summary: 'Test staff sign-in (staff must already exist, e.g. SEED_OWNER_EMAIL)', body: Type.Object({ email: Type.String({ format: 'email' }) }) },
      },
      async (req, reply) => {
        const [staff] = await db
          .select()
          .from(s.staff)
          .where(and(eq(s.staff.email, req.body.email.toLowerCase()), eq(s.staff.status, 'active')));
        if (!staff) throw notFound('Staff member');
        const out = await app.deps.issueSession!(req, reply, { type: 'staff', id: staff.id, role: staff.role }, 'admin', 'Test sign-in');
        return { staffId: staff.id, role: staff.role, ...out };
      },
    );
  }

  app.get('/payments/:paymentId', { config: { auth: 'customer' }, schema: { tags: ['Dev'], summary: 'Mock payment details', params: Type.Object({ paymentId: Type.String() }) } }, async (req) => {
    const [p] = await db
      .select()
      .from(s.payments)
      .where(and(eq(s.payments.id, req.params.paymentId), eq(s.payments.customerId, requireAuth(req).sub)));
    if (!p) throw notFound('Payment');
    const [o] = await db.select({ number: s.orders.number }).from(s.orders).where(eq(s.orders.id, p.orderId));
    return { id: p.id, orderId: p.orderId, orderNumber: o?.number, amount: { amount: p.amountPaise, currency: 'INR' }, status: p.status };
  });

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
      const [p] = await db
        .select()
        .from(s.payments)
        .where(and(eq(s.payments.id, req.params.paymentId), eq(s.payments.customerId, requireAuth(req).sub)));
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
