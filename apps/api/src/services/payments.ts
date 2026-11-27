import { paiseToRupeeString, rupeesToPaise } from '@dairy/core';
import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Payment providers. Cashfree in staging/production; a mock provider for local development
 * and tests that behaves the same way from the order flow's point of view.
 */
export interface CreateOrderInput {
  paymentId: string;
  amountPaise: number;
  customer: { id: string; name: string; email: string; phone: string };
  returnUrl: string;
  notifyUrl: string;
  expiresAt: Date;
}

export interface ProviderOrderStatus {
  status: 'PAID' | 'ACTIVE' | 'EXPIRED' | 'TERMINATED' | 'UNKNOWN';
  providerPaymentId?: string;
  method?: string;
  amountPaise?: number;
}

export interface PaymentProvider {
  name: 'cashfree' | 'mock';
  environment: 'sandbox' | 'production' | 'mock';
  createOrder(input: CreateOrderInput): Promise<{ providerOrderId: string; paymentSessionId: string }>;
  fetchOrder(providerOrderId: string): Promise<ProviderOrderStatus>;
  refund(input: { providerOrderId: string; refundId: string; amountPaise: number; note: string }): Promise<{ providerRefundId: string; status: 'pending' | 'success' }>;
  verifyWebhook(rawBody: string, headers: Record<string, string | string[] | undefined>, now?: Date): boolean;
}

export class PaymentProviderError extends Error {}

type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

/** Cashfree Payment Gateway (PG) API v2025-01-01. Docs: docs/07-payments-cashfree.md */
export function createCashfreeProvider(opts: { appId: string; secretKey: string; environment: 'sandbox' | 'production'; apiVersion: string; fetch?: FetchLike }): PaymentProvider {
  const base = opts.environment === 'production' ? 'https://api.cashfree.com/pg' : 'https://sandbox.cashfree.com/pg';
  const http = opts.fetch ?? ((url, init) => fetch(url, init));
  const headers = {
    'content-type': 'application/json',
    'x-client-id': opts.appId,
    'x-client-secret': opts.secretKey,
    'x-api-version': opts.apiVersion,
  };

  async function call<T>(method: string, path: string, body?: unknown, idempotencyKey?: string): Promise<T> {
    const res = await http(`${base}${path}`, {
      method,
      headers: { ...headers, ...(idempotencyKey ? { 'x-idempotency-key': idempotencyKey } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(10_000),
    });
    const json = (await res.json().catch(() => ({}))) as T & { message?: string };
    if (!res.ok) throw new PaymentProviderError(`Cashfree ${method} ${path} → ${res.status}: ${json.message ?? 'error'}`);
    return json;
  }

  return {
    name: 'cashfree',
    environment: opts.environment,
    async createOrder(input) {
      const r = await call<{ order_id: string; payment_session_id: string }>(
        'POST',
        '/orders',
        {
          order_id: input.paymentId,
          order_amount: Number(paiseToRupeeString(input.amountPaise)),
          order_currency: 'INR',
          customer_details: {
            customer_id: input.customer.id,
            customer_name: input.customer.name,
            customer_email: input.customer.email,
            customer_phone: input.customer.phone.replace(/^\+91/, ''),
          },
          order_meta: { return_url: input.returnUrl, notify_url: input.notifyUrl },
          order_expiry_time: input.expiresAt.toISOString(),
        },
        input.paymentId,
      );
      return { providerOrderId: r.order_id, paymentSessionId: r.payment_session_id };
    },
    async fetchOrder(providerOrderId) {
      const order = await call<{ order_status: string; order_amount: number }>('GET', `/orders/${encodeURIComponent(providerOrderId)}`);
      const status = (['PAID', 'ACTIVE', 'EXPIRED', 'TERMINATED'].includes(order.order_status) ? order.order_status : 'UNKNOWN') as ProviderOrderStatus['status'];
      if (status !== 'PAID') return { status };
      const payments = await call<{ cf_payment_id: string | number; payment_status: string; payment_group?: string }[]>('GET', `/orders/${encodeURIComponent(providerOrderId)}/payments`);
      const paid = payments.find((p) => p.payment_status === 'SUCCESS');
      return { status, providerPaymentId: paid ? String(paid.cf_payment_id) : undefined, method: paid?.payment_group, amountPaise: rupeesToPaise(order.order_amount) };
    },
    async refund(input) {
      const r = await call<{ cf_refund_id: string | number; refund_status: string }>(
        'POST',
        `/orders/${encodeURIComponent(input.providerOrderId)}/refunds`,
        { refund_amount: Number(paiseToRupeeString(input.amountPaise)), refund_id: input.refundId, refund_note: input.note.slice(0, 100) },
        input.refundId,
      );
      return { providerRefundId: String(r.cf_refund_id), status: r.refund_status === 'SUCCESS' ? 'success' : 'pending' };
    },
    verifyWebhook(rawBody, h, now = new Date()) {
      return verifyCashfreeSignature(rawBody, h, opts.secretKey, now);
    },
  };
}

/** HMAC-SHA256 over timestamp + raw body, base64, constant-time compare, 5-minute freshness. */
export function verifyCashfreeSignature(rawBody: string, h: Record<string, string | string[] | undefined>, secret: string, now = new Date()): boolean {
  const signature = String(h['x-webhook-signature'] ?? '');
  const timestamp = String(h['x-webhook-timestamp'] ?? '');
  if (!signature || !timestamp) return false;
  const tsMs = Number(timestamp) > 1e12 ? Number(timestamp) : Number(timestamp) * 1000;
  if (!Number.isFinite(tsMs) || Math.abs(now.getTime() - tsMs) > 5 * 60_000) return false;
  const expected = createHmac('sha256', secret)
    .update(timestamp + rawBody)
    .digest('base64');
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function signCashfreeWebhook(rawBody: string, secret: string, timestamp: string): string {
  return createHmac('sha256', secret)
    .update(timestamp + rawBody)
    .digest('base64');
}

/** In-memory provider for development and tests. Payments are completed with POST /v1/dev/payments/:id/simulate. */
export function createMockProvider(): PaymentProvider & { outcomes: Map<string, ProviderOrderStatus>; refunds: { providerOrderId: string; amountPaise: number }[] } {
  const outcomes = new Map<string, ProviderOrderStatus>();
  const refunds: { providerOrderId: string; amountPaise: number }[] = [];
  return {
    name: 'mock',
    environment: 'mock',
    outcomes,
    refunds,
    async createOrder(input) {
      outcomes.set(input.paymentId, { status: 'ACTIVE' });
      return { providerOrderId: input.paymentId, paymentSessionId: `mock_${input.paymentId}` };
    },
    async fetchOrder(providerOrderId) {
      return outcomes.get(providerOrderId) ?? { status: 'UNKNOWN' };
    },
    async refund(input) {
      refunds.push({ providerOrderId: input.providerOrderId, amountPaise: input.amountPaise });
      return { providerRefundId: `mock_rf_${input.refundId}`, status: 'success' };
    },
    verifyWebhook() {
      return false; // the mock never receives real webhooks
    },
  };
}
