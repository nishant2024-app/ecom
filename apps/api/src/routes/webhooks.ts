import { newId } from '@dairy/core';
import { schema as s } from '@dairy/db';
import { eq } from 'drizzle-orm';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { createHash } from 'node:crypto';
import { sendProblem } from '../lib/errors';
import { markPaid, markPaymentFailed } from '../services/orders';

interface CashfreeEvent {
  type?: string;
  event_time?: string;
  data?: {
    order?: { order_id?: string; order_amount?: number };
    payment?: { cf_payment_id?: string | number; payment_status?: string; payment_group?: string };
  };
}

/**
 * Inbound Cashfree webhooks (docs/api/webhooks.md). The raw body is kept for signature
 * verification; events are stored once (deduplicated) before processing.
 */
export default async function webhookRoutes(app: FastifyInstance) {
  app.addContentTypeParser('application/json', { parseAs: 'string', bodyLimit: 128 * 1024 }, (req, body, done) => {
    (req as FastifyRequest & { rawBody?: string }).rawBody = body as string;
    try {
      done(null, JSON.parse(body as string));
    } catch (err) {
      done(err as Error, undefined);
    }
  });

  app.post('/cashfree/payments', { config: { auth: 'public', rateLimit: false, csrf: false }, schema: { tags: ['Webhooks'], summary: 'Cashfree payment events', hide: false } }, async (req, reply) => {
    const raw = (req as FastifyRequest & { rawBody?: string }).rawBody ?? '';
    const valid = app.deps.payments.verifyWebhook(raw, req.headers, app.deps.now());
    if (!valid) {
      req.log.warn({ type: (req.body as CashfreeEvent)?.type }, 'cashfree webhook with invalid signature');
      return sendProblem(req, reply, 'VALIDATION_FAILED', 400, 'Invalid webhook signature');
    }
    const event = req.body as CashfreeEvent;
    const paymentRef = event.data?.order?.order_id;
    const eventKey = createHash('sha256').update(`${event.type}|${paymentRef}|${event.data?.payment?.cf_payment_id ?? ''}|${event.data?.payment?.payment_status ?? ''}`).digest('hex');
    const { db } = app.deps.db;
    const inserted = await db
      .insert(s.webhookEvents)
      .values({ id: newId('whe'), provider: 'cashfree', eventKey, type: event.type ?? 'unknown', signatureValid: true, payload: event as object })
      .onConflictDoNothing()
      .returning({ id: s.webhookEvents.id });
    if (inserted.length === 0) return reply.status(200).send({ status: 'duplicate' });

    try {
      const [payment] = paymentRef ? await db.select().from(s.payments).where(eq(s.payments.providerOrderId, paymentRef)) : [];
      if (payment) {
        const status = event.data?.payment?.payment_status;
        if (event.type === 'PAYMENT_SUCCESS_WEBHOOK' || status === 'SUCCESS') {
          await markPaid(app.deps, payment.id, { providerPaymentId: String(event.data?.payment?.cf_payment_id ?? ''), method: event.data?.payment?.payment_group, raw: event });
        } else if (event.type === 'PAYMENT_USER_DROPPED_WEBHOOK' || status === 'USER_DROPPED') {
          await markPaymentFailed(app.deps, payment.id, 'user_dropped', event);
        } else if (event.type === 'PAYMENT_FAILED_WEBHOOK' || status === 'FAILED') {
          await markPaymentFailed(app.deps, payment.id, 'failed', event);
        }
      } else {
        req.log.warn({ paymentRef }, 'webhook for unknown payment');
      }
      await db.update(s.webhookEvents).set({ processedAt: new Date() }).where(eq(s.webhookEvents.id, inserted[0]!.id));
      return reply.status(200).send({ status: 'processed' });
    } catch (err) {
      await db.update(s.webhookEvents).set({ error: err instanceof Error ? err.message : String(err) }).where(eq(s.webhookEvents.id, inserted[0]!.id));
      throw err; // 500 → Cashfree retries
    }
  });
}
