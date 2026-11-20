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
    const placed = await t.app.inject({ method: 'POST', url: '/v1/store/orders', headers: { ...c.headers, 'idempotency-key': crypto.randomUUID() }, payload: { lines: [{ variantId: ids.peda, quantity: 3 }], addressId: c.addressId } });
    expect(placed.statusCode, placed.body).toBe(201);
    const { order, payment } = placed.json();
    await t.app.inject({ method: 'POST', url: `/v1/dev/payments/${payment.id}/simulate`, headers: c.headers, payload: { outcome: 'success' } });
    const staff = await staffHeaders(t, 'ops_manager');
    await t.app.inject({ method: 'POST', url: `/v1/admin/orders/${order.id}/pack`, headers: staff });
    await t.app.inject({ method: 'POST', url: `/v1/admin/orders/${order.id}/ship`, headers: staff, payload: { courier: 'Delhivery', trackingNumber: 'DLV1234567' } });
    expect((await t.app.inject({ method: 'POST', url: `/v1/admin/orders/${order.id}/deliver`, headers: staff })).statusCode).toBe(200);

    const write = await t.app.inject({ method: 'PUT', url: `/v1/store/products/${slug}/reviews/mine`, headers: c.headers, payload: { rating: 4, title: 'Like home', body: 'Soft and not too sweet.' } });
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
