import { newId } from '@dairy/core';
import { schema as s } from '@dairy/db';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createCashfreeProvider, signCashfreeWebhook } from '../src/services/payments';
import { expireUnpaidOrders } from '../src/services/orders';
import { createTestApp, readyCustomer, stockOf, variantIds, type TestApp } from './helpers';

let t: TestApp;
beforeAll(async () => {
  t = await createTestApp();
});
afterAll(() => t.close());

const place = (c: { headers: Record<string, string>; addressId: string }, lines: { variantId: string; quantity: number }[], key = crypto.randomUUID()) =>
  t.app.inject({ method: 'POST', url: '/v1/store/orders', headers: { ...c.headers, 'idempotency-key': key }, payload: { lines, addressId: c.addressId } });

describe('placing and paying for orders', () => {
  it('reserves stock, takes a (mock) payment and confirms the order', async () => {
    const c = await readyCustomer(t);
    const ids = await variantIds(t);
    const before = await stockOf(t, ids.powder500);
    const key = crypto.randomUUID();
    const res = await place(c, [{ variantId: ids.powder500, quantity: 2 }], key);
    expect(res.statusCode).toBe(201);
    const { order, payment } = res.json();
    // ₹580 is above the ₹499 free-shipping threshold for Pune.
    expect(order).toMatchObject({ status: 'pending_payment', number: expect.stringMatching(/^D-\d{6}-\d{4}$/), shipping: { amount: 0 }, total: { amount: 58000 } });
    expect(payment).toMatchObject({ provider: 'mock', mockCheckoutPath: `/checkout/pay/${payment.id}`, paymentSessionId: `mock_${payment.id}` });
    expect(await stockOf(t, ids.powder500)).toBe(before - 2);

    // Retrying the same request returns the same order.
    const replay = await place(c, [{ variantId: ids.powder500, quantity: 2 }], key);
    expect(replay.json().order.id).toBe(order.id);

    const pay = await t.app.inject({ method: 'POST', url: `/v1/dev/payments/${payment.id}/simulate`, headers: c.headers, payload: { outcome: 'success' } });
    expect(pay.statusCode).toBe(200);
    const detail = (await t.app.inject({ url: `/v1/store/orders/${order.id}`, headers: c.headers })).json();
    expect(detail).toMatchObject({ status: 'confirmed', canCancel: true, payment: { status: 'success', method: 'upi' } });
    expect(detail.timeline.paidAt).not.toBeNull();
    const list = (await t.app.inject({ url: '/v1/store/orders', headers: c.headers })).json();
    expect(list.data[0]).toMatchObject({ id: order.id, itemCount: 2 });
  });

  it("refuses unserviceable pincodes, out-of-stock items and other people's orders", async () => {
    const ids = await variantIds(t);
    const apo = await readyCustomer(t, '900001');
    expect((await place(apo, [{ variantId: ids.uht1l, quantity: 1 }])).json().code).toBe('NOT_SERVICEABLE');
    const c = await readyCustomer(t);
    const tooMany = await place(c, [{ variantId: ids.milkCake, quantity: 30 }]);
    expect(tooMany.json().code).toBe('OUT_OF_STOCK');
    const mine = (await place(c, [{ variantId: ids.uht1l, quantity: 1 }])).json().order.id;
    const other = await readyCustomer(t);
    expect((await t.app.inject({ url: `/v1/store/orders/${mine}`, headers: other.headers })).statusCode).toBe(404);
  });

  it('lets customers cancel before packing, releasing stock and refunding the payment', async () => {
    const c = await readyCustomer(t);
    const ids = await variantIds(t);
    const before = await stockOf(t, ids.peda);
    const { order, payment } = (await place(c, [{ variantId: ids.peda, quantity: 1 }])).json();
    await t.app.inject({ method: 'POST', url: `/v1/dev/payments/${payment.id}/simulate`, headers: c.headers, payload: { outcome: 'success' } });
    const cancelled = await t.app.inject({ method: 'POST', url: `/v1/store/orders/${order.id}/cancel`, headers: c.headers, payload: { reason: 'Ordered twice' } });
    expect(cancelled.json()).toMatchObject({ status: 'cancelled', cancelReason: 'Ordered twice', refunds: [{ status: 'success', amount: { amount: order.total.amount } }] });
    expect(await stockOf(t, ids.peda)).toBe(before);
  });

  it('expires unpaid orders after the payment window and releases stock', async () => {
    const c = await readyCustomer(t);
    const ids = await variantIds(t);
    const before = await stockOf(t, ids.buffalo500);
    const { order } = (await place(c, [{ variantId: ids.buffalo500, quantity: 3 }])).json();
    expect(await stockOf(t, ids.buffalo500)).toBe(before - 3);
    const later = new Date(t.now.getTime() + 31 * 60_000);
    const result = await expireUnpaidOrders({ ...t.app.deps, now: () => later });
    expect(result.expired).toBeGreaterThanOrEqual(1);
    const detail = (await t.app.inject({ url: `/v1/store/orders/${order.id}`, headers: c.headers })).json();
    expect(detail).toMatchObject({ status: 'cancelled', cancelReason: 'Payment not completed in time' });
    expect(await stockOf(t, ids.buffalo500)).toBe(before);
  });
});

describe('Cashfree', () => {
  const secret = 'test-secret';
  const calls: { url: string; body: unknown }[] = [];
  const fakeFetch = async (url: string, init: RequestInit) => {
    calls.push({ url, body: init.body ? JSON.parse(String(init.body)) : null });
    if (url.endsWith('/orders') && init.method === 'POST') {
      const body = JSON.parse(String(init.body));
      return new Response(JSON.stringify({ order_id: body.order_id, payment_session_id: `session_${body.order_id}` }), { status: 200 });
    }
    return new Response(JSON.stringify({ order_status: 'ACTIVE' }), { status: 200 });
  };
  let cf: TestApp;
  beforeAll(async () => {
    cf = await createTestApp(new Date(), createCashfreeProvider({ appId: 'app', secretKey: secret, environment: 'sandbox', apiVersion: '2025-01-01', fetch: fakeFetch }));
  });
  afterAll(() => cf.close());

  it('creates a Cashfree order with amounts in rupees and confirms on a signed webhook, once', async () => {
    const c = await readyCustomer(cf);
    const ids = await variantIds(cf);
    const res = await cf.app.inject({
      method: 'POST',
      url: '/v1/store/orders',
      headers: { ...c.headers, 'idempotency-key': crypto.randomUUID() },
      payload: { lines: [{ variantId: ids.ghee500, quantity: 1 }], addressId: c.addressId },
    });
    const { order, payment } = res.json();
    expect(payment).toMatchObject({ provider: 'cashfree', environment: 'sandbox', paymentSessionId: `session_${payment.id}`, mockCheckoutPath: null });
    const created = calls.find((x) => x.url.endsWith('/orders'))!.body as { order_amount: number; order_currency: string; customer_details: { customer_phone: string } };
    expect(created).toMatchObject({ order_amount: 1150, order_currency: 'INR', customer_details: { customer_phone: '9876543210' } });
    expect((await cf.app.inject({ method: 'POST', url: `/v1/dev/payments/${payment.id}/simulate`, headers: c.headers, payload: { outcome: 'success' } })).statusCode).toBe(404);

    const body = JSON.stringify({
      type: 'PAYMENT_SUCCESS_WEBHOOK',
      data: { order: { order_id: payment.id, order_amount: 1150 }, payment: { cf_payment_id: 998877, payment_status: 'SUCCESS', payment_group: 'upi' } },
    });
    const timestamp = String(Math.floor(Date.now() / 1000));
    const send = (signature: string) =>
      cf.app.inject({
        method: 'POST',
        url: '/v1/webhooks/cashfree/payments',
        headers: { 'content-type': 'application/json', 'x-webhook-timestamp': timestamp, 'x-webhook-signature': signature },
        payload: body,
      });

    expect((await send('bad-signature')).statusCode).toBe(400);
    const ok = await send(signCashfreeWebhook(body, secret, timestamp));
    expect(ok.json()).toEqual({ status: 'processed' });
    expect((await send(signCashfreeWebhook(body, secret, timestamp))).json()).toEqual({ status: 'duplicate' });

    const detail = (await cf.app.inject({ url: `/v1/store/orders/${order.id}`, headers: c.headers })).json();
    expect(detail).toMatchObject({ status: 'confirmed', payment: { status: 'success', method: 'upi' } });
    const [stored] = await cf.db.select().from(s.payments).where(eq(s.payments.id, payment.id));
    expect(stored!.providerPaymentId).toBe('998877');
  });

  it('rejects stale webhook timestamps', async () => {
    const body = JSON.stringify({ type: 'PAYMENT_SUCCESS_WEBHOOK', data: { order: { order_id: newId('pay') } } });
    const old = String(Math.floor(Date.now() / 1000) - 3600);
    const res = await cf.app.inject({
      method: 'POST',
      url: '/v1/webhooks/cashfree/payments',
      headers: { 'content-type': 'application/json', 'x-webhook-timestamp': old, 'x-webhook-signature': signCashfreeWebhook(body, secret, old) },
      payload: body,
    });
    expect(res.statusCode).toBe(400);
  });
});
