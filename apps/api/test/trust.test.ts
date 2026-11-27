import { schema as s } from '@dairy/db';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, readyCustomer, staffHeaders, variantIds, type TestApp } from './helpers';

let t: TestApp;
beforeAll(async () => {
  t = await createTestApp();
});
afterAll(() => t.close());

describe('catalog trust signals', () => {
  it('shows unit price and the batch each size ships from next', async () => {
    const p = (await t.app.inject({ url: '/v1/store/products/a2-gir-cow-ghee' })).json();
    const v500 = p.variants.find((v: { packSize: string }) => v.packSize === '500 ml');
    expect(v500.unitPrice).toEqual({ amount: { amount: 23000, currency: 'INR' }, per: '100 ml' });
    expect(v500.nextBatch.manufacturedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(v500.nextBatch.bestBefore > v500.nextBatch.manufacturedOn).toBe(true);
    // FEFO: the older batch (sooner expiry) ships first.
    const batches = await t.db.select().from(s.batches).where(eq(s.batches.variantId, v500.id));
    const soonest = batches.filter((b) => b.onHand > b.reserved).sort((a, b) => a.expiresOn.localeCompare(b.expiresOn))[0]!;
    expect(v500.nextBatch.bestBefore).toBe(soonest.expiresOn);
    expect(p.rating).toBeNull();
  });

  it('lists recently made batches, newest first, one per product', async () => {
    const res = (await t.app.inject({ url: '/v1/store/fresh' })).json();
    expect(res.data.length).toBeGreaterThan(0);
    const slugs = res.data.map((d: { product: { slug: string } }) => d.product.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(res.data[0].daysAgo).toBeLessThanOrEqual(res.data.at(-1).daysAgo);
    expect(res.data[0].daysAgo).toBeLessThanOrEqual(21);
  });

  it('verifies a batch code printed on the pack, case-insensitively', async () => {
    const res = await t.app.inject({ url: '/v1/store/verify/gh-a2-500-b' });
    expect(res.statusCode, res.body).toBe(200);
    expect(res.json()).toMatchObject({ genuine: true, code: 'GH-A2-500-B', product: { slug: 'a2-gir-cow-ghee', packSize: '500 ml' }, expired: false });
    const fake = await t.app.inject({ url: '/v1/store/verify/FAKE-123' });
    expect(fake.statusCode).toBe(404);
    expect(fake.json().code).toBe('BATCH_NOT_FOUND');
  });
});

describe('verified reviews', () => {
  it('only customers with a delivered order can review, and reviews show after approval', async () => {
    const c = await readyCustomer(t);
    const ids = await variantIds(t);
    const slug = 'kandi-peda';

    const early = await t.app.inject({ method: 'PUT', url: `/v1/store/products/${slug}/reviews/mine`, headers: c.headers, payload: { rating: 5, body: 'Great' } });
    expect(early.statusCode).toBe(403);
    expect((await t.app.inject({ url: `/v1/store/products/${slug}/reviews/mine`, headers: c.headers })).json()).toEqual({ eligible: false, review: null });

    // Buy, pay, and have staff pack, ship and deliver it.
    const placed = await t.app.inject({
      method: 'POST',
      url: '/v1/store/orders',
      headers: { ...c.headers, 'idempotency-key': crypto.randomUUID() },
      payload: { lines: [{ variantId: ids.peda, quantity: 3 }], addressId: c.addressId },
    });
    expect(placed.statusCode, placed.body).toBe(201);
    const { order, payment } = placed.json();
    await t.app.inject({ method: 'POST', url: `/v1/dev/payments/${payment.id}/simulate`, headers: c.headers, payload: { outcome: 'success' } });
    const staff = await staffHeaders(t, 'ops_manager');
    await t.app.inject({ method: 'POST', url: `/v1/admin/orders/${order.id}/pack`, headers: staff });
    await t.app.inject({ method: 'POST', url: `/v1/admin/orders/${order.id}/ship`, headers: staff, payload: { courier: 'Delhivery', trackingNumber: 'DLV1234567' } });
    expect((await t.app.inject({ method: 'POST', url: `/v1/admin/orders/${order.id}/deliver`, headers: staff })).statusCode).toBe(200);

    const write = await t.app.inject({
      method: 'PUT',
      url: `/v1/store/products/${slug}/reviews/mine`,
      headers: c.headers,
      payload: { rating: 4, title: 'Like home', body: 'Soft and not too sweet.' },
    });
    expect(write.json()).toEqual({ status: 'pending' });
    // Pending reviews are not public.
    expect((await t.app.inject({ url: `/v1/store/products/${slug}/reviews` })).json().summary.count).toBe(0);

    const content = await staffHeaders(t, 'content');
    const queue = (await t.app.inject({ url: '/v1/admin/reviews?status=pending', headers: content })).json();
    const mine = queue.data.find((r: { orderNumber: string }) => r.orderNumber === order.number);
    expect(mine).toMatchObject({ rating: 4, author: 'Asha T.', product: { slug } });
    expect((await t.app.inject({ method: 'PATCH', url: `/v1/admin/reviews/${mine.id}`, headers: content, payload: { status: 'approved' } })).statusCode).toBe(200);

    const pub = (await t.app.inject({ url: `/v1/store/products/${slug}/reviews` })).json();
    expect(pub.summary).toMatchObject({ average: 4, count: 1, breakdown: { '4': 1, '5': 0 } });
    expect(pub.data[0]).toMatchObject({ title: 'Like home', author: 'Asha T.', verified: true });
    expect((await t.app.inject({ url: `/v1/store/products/${slug}` })).json().rating).toEqual({ average: 4, count: 1 });

    // Editing sends it back for approval.
    await t.app.inject({ method: 'PUT', url: `/v1/store/products/${slug}/reviews/mine`, headers: c.headers, payload: { rating: 5 } });
    expect((await t.app.inject({ url: `/v1/store/products/${slug}/reviews` })).json().summary.count).toBe(0);
  });
});

describe('exact delivery location', () => {
  it('saves a GPS point on the address, rejects points outside India, and copies it to orders', async () => {
    const c = await readyCustomer(t);
    const ids = await variantIds(t);
    const outside = await t.app.inject({
      method: 'PATCH',
      url: `/v1/store/me/addresses/${c.addressId}`,
      headers: c.headers,
      payload: { name: 'Asha Test', phone: '9876543210', line1: 'Flat 704, Sai Residency', city: 'Pune', pincode: '411045', location: { lat: 51.5, lng: -0.12, source: 'device' } },
    });
    expect(outside.statusCode).toBe(400);

    const ok = await t.app.inject({
      method: 'PATCH',
      url: `/v1/store/me/addresses/${c.addressId}`,
      headers: c.headers,
      payload: {
        name: 'Asha Test',
        phone: '9876543210',
        line1: 'Flat 704, Sai Residency',
        city: 'Pune',
        pincode: '411045',
        location: { lat: 18.55901234567, lng: 73.7868, accuracyM: 12, source: 'device' },
      },
    });
    expect(ok.statusCode, ok.body).toBe(200);
    expect(ok.json().location).toEqual({ lat: 18.559012, lng: 73.7868, accuracyM: 12, source: 'device', directionsUrl: 'https://www.google.com/maps/dir/?api=1&destination=18.559012,73.7868' });

    const placed = await t.app.inject({
      method: 'POST',
      url: '/v1/store/orders',
      headers: { ...c.headers, 'idempotency-key': crypto.randomUUID() },
      payload: { lines: [{ variantId: ids.powder500, quantity: 1 }], addressId: c.addressId },
    });
    const orderId = placed.json().order.id;
    const staff = await staffHeaders(t, 'warehouse');
    const detail = (await t.app.inject({ url: `/v1/admin/orders/${orderId}`, headers: staff })).json();
    expect(detail.shippingAddress.location).toMatchObject({ lat: 18.559012, lng: 73.7868, source: 'device', directionsUrl: expect.stringContaining('destination=18.559012,73.7868') });

    // Clearing the pin keeps the typed address.
    const cleared = await t.app.inject({
      method: 'PATCH',
      url: `/v1/store/me/addresses/${c.addressId}`,
      headers: c.headers,
      payload: { name: 'Asha Test', phone: '9876543210', line1: 'Flat 704, Sai Residency', city: 'Pune', pincode: '411045', location: null },
    });
    expect(cleared.json().location).toBeNull();
  });

  it('suggests address fields for a map point (signed-in only)', async () => {
    const c = await readyCustomer(t);
    expect((await t.app.inject({ url: '/v1/store/geo/reverse?lat=18.559&lng=73.7868' })).statusCode).toBe(401);
    const r = await t.app.inject({ url: '/v1/store/geo/reverse?lat=18.559&lng=73.7868', headers: c.headers });
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json()).toMatchObject({ area: 'Baner Road, Baner', city: 'Pune', state: 'Maharashtra', pincode: '411045', provider: 'test' });
    expect((await t.app.inject({ url: '/v1/store/geo/reverse?lat=0&lng=0', headers: c.headers })).statusCode).toBe(400);
  });
});

describe('order emails', () => {
  it('emails the customer when an order is paid, shipped, delivered and cancelled; never twice; respects the opt-out', async () => {
    const { sendPendingEmails } = await import('../src/services/order-emails');
    const deps = t.app.deps;
    const c = await readyCustomer(t);
    const ids = await variantIds(t);
    const staff = await staffHeaders(t, 'ops_manager');
    const mine = () => t.emails.filter((e) => e.to === c.body.user.email);
    const place = async () => {
      const r = await t.app.inject({
        method: 'POST',
        url: '/v1/store/orders',
        headers: { ...c.headers, 'idempotency-key': crypto.randomUUID() },
        payload: { lines: [{ variantId: ids.powder500, quantity: 1 }], addressId: c.addressId },
      });
      const { order, payment } = r.json();
      await t.app.inject({ method: 'POST', url: `/v1/dev/payments/${payment.id}/simulate`, headers: c.headers, payload: { outcome: 'success' } });
      return order as { id: string; number: string };
    };

    await sendPendingEmails(deps, 500); // clear anything queued by earlier tests
    const o1 = await place();
    expect(mine()).toHaveLength(0); // queued, not sent until the worker runs
    expect(await sendPendingEmails(deps, 500)).toMatchObject({ sent: 1 });
    expect(mine()[0]).toMatchObject({ subject: `Order ${o1.number} confirmed` });
    expect(mine()[0]!.text).toContain('Whole Milk Powder');
    expect(mine()[0]!.html).toContain('View your order');

    await t.app.inject({ method: 'POST', url: `/v1/admin/orders/${o1.id}/pack`, headers: staff });
    await t.app.inject({
      method: 'POST',
      url: `/v1/admin/orders/${o1.id}/ship`,
      headers: staff,
      payload: { courier: 'Delhivery', trackingNumber: 'DLV777', trackingUrl: 'https://track.example/DLV777' },
    });
    await t.app.inject({ method: 'POST', url: `/v1/admin/orders/${o1.id}/deliver`, headers: staff });
    await sendPendingEmails(deps, 500);
    expect(mine().map((e) => e.subject)).toEqual([`Order ${o1.number} confirmed`, `Your order ${o1.number} is on its way`, `Delivered: order ${o1.number}`]);
    expect(mine()[1]!.text).toContain('DLV777');
    expect(mine()[1]!.html).toContain('https://track.example/DLV777');
    expect((await sendPendingEmails(deps, 500)).sent).toBe(0); // nothing is sent twice

    // Cancelling a paid order mentions the refund.
    const o2 = await place();
    await sendPendingEmails(deps);
    await t.app.inject({ method: 'POST', url: `/v1/store/orders/${o2.id}/cancel`, headers: c.headers, payload: { reason: 'Changed my mind' } });
    await sendPendingEmails(deps);
    const cancelled = mine().at(-1)!;
    expect(cancelled.subject).toBe(`Order ${o2.number} cancelled`);
    expect(cancelled.text).toMatch(/refund of ₹330/);

    // The admin sees what was sent for the order.
    const detail = (await t.app.inject({ url: `/v1/admin/orders/${o1.id}`, headers: staff })).json();
    expect(detail.emails.map((e: { template: string; status: string }) => `${e.template}:${e.status}`).sort()).toEqual(['order_confirmed:sent', 'order_delivered:sent', 'order_shipped:sent']);

    // Opting out of order updates stops the emails.
    await t.app.inject({ method: 'PUT', url: '/v1/store/me/notification-preferences', headers: c.headers, payload: { orderUpdates: false } });
    const before = mine().length;
    await place();
    await sendPendingEmails(deps);
    expect(mine()).toHaveLength(before);
  });

  it('retries a failing provider, then gives up and shows the error', async () => {
    const { sendPendingEmails } = await import('../src/services/order-emails');
    const deps = t.app.deps;
    await sendPendingEmails(deps, 500);
    const real = deps.email!;
    let calls = 0;
    deps.email = {
      name: 'broken',
      send: async () =>
        void (
          calls++,
          (() => {
            throw new Error('provider 503');
          })()
        ),
    };
    const c = await readyCustomer(t);
    const ids = await variantIds(t);
    const r = await t.app.inject({
      method: 'POST',
      url: '/v1/store/orders',
      headers: { ...c.headers, 'idempotency-key': crypto.randomUUID() },
      payload: { lines: [{ variantId: ids.powder500, quantity: 1 }], addressId: c.addressId },
    });
    await t.app.inject({ method: 'POST', url: `/v1/dev/payments/${r.json().payment.id}/simulate`, headers: c.headers, payload: { outcome: 'success' } });
    for (let i = 0; i < 6; i++) await sendPendingEmails(deps);
    expect(calls).toBe(5);
    const [row] = await t.db.select().from(s.notifications).where(eq(s.notifications.customerId, c.customerId));
    expect(row).toMatchObject({ status: 'failed', attempts: 5, lastError: 'provider 503' });
    deps.email = real;
  });
});
