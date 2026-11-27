import { schema as s } from '@dairy/db';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, readyCustomer, staffHeaders, uniq, variantIds, type TestApp } from './helpers';

let t: TestApp;
let ids: Awaited<ReturnType<typeof variantIds>>;
let admin: Awaited<ReturnType<typeof staffHeaders>>;
beforeAll(async () => {
  t = await createTestApp();
  ids = await variantIds(t);
  admin = await staffHeaders(t, 'owner');
});
afterAll(() => t.close());

const make = async (body: Record<string, unknown>) => {
  const res = await t.app.inject({ method: 'POST', url: '/v1/admin/coupons', headers: admin, payload: { kind: 'percent', percentBps: 1000, ...body } });
  expect(res.statusCode, res.body).toBe(201);
  return res.json() as { id: string; code: string };
};
const code = (p: string) => `${p}${uniq().toUpperCase().slice(0, 6)}`;
const quote = (lines: { variantId: string; quantity: number }[], couponCode?: string, headers: Record<string, string> = {}) =>
  t.app.inject({ method: 'POST', url: '/v1/store/checkout/quote', headers, payload: { lines, pincode: '411045', ...(couponCode ? { couponCode } : {}) } });
const place = (c: { headers: Record<string, string>; addressId: string }, lines: { variantId: string; quantity: number }[], couponCode?: string) =>
  t.app.inject({ method: 'POST', url: '/v1/store/orders', headers: { ...c.headers, 'idempotency-key': crypto.randomUUID() }, payload: { lines, addressId: c.addressId, ...(couponCode ? { couponCode } : {}) } });

describe('coupons', () => {
  it('takes a percentage off the products, caps it, and keeps GST and shipping correct', async () => {
    const c1 = code('TEN');
    await make({ code: c1, percentBps: 1000, maxDiscountPaise: 5000 });
    // 1 × Whole Milk Powder 500 g = ₹290; 10% = ₹29. Shipping to Pune is ₹40 below ₹499.
    const q = (await quote([{ variantId: ids.powder500, quantity: 1 }], c1.toLowerCase())).json();
    expect(q.coupon).toMatchObject({ code: c1, description: '10% off, up to ₹50' });
    expect(q.discount.amount).toBe(2900);
    expect(q.total.amount).toBe(29000 - 2900 + 4000);
    const noCoupon = (await quote([{ variantId: ids.powder500, quantity: 1 }])).json();
    expect(q.taxIncluded.amount).toBeLessThan(noCoupon.taxIncluded.amount); // GST falls with the discount
    // The cap applies on a bigger cart: 2 × ₹1,150 ghee = ₹2,300, 10% = ₹230, capped at ₹50.
    const big = (await quote([{ variantId: ids.ghee500, quantity: 2 }], c1)).json();
    expect(big.discount.amount).toBe(5000);
  });

  it('explains why a code does not work', async () => {
    const minCode = code('MIN');
    await make({ code: minCode, minSubtotalPaise: 100000 });
    const low = (await quote([{ variantId: ids.powder500, quantity: 1 }], minCode)).json();
    expect(low.coupon).toBeNull();
    expect(low.couponError).toMatch(/Add ₹710 more/);
    expect((await quote([{ variantId: ids.powder500, quantity: 1 }], 'NOSUCHCODE')).json().couponError).toBe('This code is not valid.');
    const expired = code('OLD');
    await make({ code: expired, endsAt: '2020-01-01T00:00:00Z' });
    expect((await quote([{ variantId: ids.powder500, quantity: 1 }], expired)).json().couponError).toBe('This code has expired.');
    const paused = code('OFF');
    await make({ code: paused, status: 'paused' });
    expect((await quote([{ variantId: ids.powder500, quantity: 1 }], paused)).json().couponError).toBe('This code is not valid.');
  });

  it('applies to the order, records the redemption, enforces one use per customer, and a cancel frees the use', async () => {
    const one = code('ONCE');
    const { id } = await make({ code: one, kind: 'fixed', percentBps: undefined, amountPaise: 5000 });
    const c = await readyCustomer(t);
    const res = await place(c, [{ variantId: ids.powder500, quantity: 2 }], one);
    expect(res.statusCode, res.body).toBe(201);
    const { order } = res.json();
    // 2 × ₹290 = ₹580, minus ₹50, free shipping (₹530 is still above ₹499).
    expect(order).toMatchObject({ couponCode: one, discount: { amount: 5000 }, subtotal: { amount: 58000 }, shipping: { amount: 0 }, total: { amount: 53000 } });
    const [rd] = await t.db.select().from(s.couponRedemptions).where(eq(s.couponRedemptions.orderId, order.id));
    expect(rd).toMatchObject({ couponId: id, amountPaise: 5000 });

    // Same customer can't use it again while that order stands...
    expect((await quote([{ variantId: ids.powder500, quantity: 1 }], one, c.headers)).json().couponError).toBe('You have already used this code.');
    const again = await place(c, [{ variantId: ids.powder500, quantity: 1 }], one);
    expect(again.statusCode).toBe(422);
    expect(again.json().code).toBe('COUPON_INVALID');
    // ...but another customer can, and cancelling gives the use back.
    await t.app.inject({ method: 'POST', url: `/v1/store/orders/${order.id}/cancel`, headers: c.headers, payload: { reason: 'test' } });
    expect((await place(c, [{ variantId: ids.powder500, quantity: 1 }], one)).statusCode).toBe(201);
  });

  it('applies the discount to the price the shipping threshold looks at', async () => {
    const big = code('BIG');
    await make({ code: big, percentBps: 5000 });
    // ₹580 qualifies for free shipping; 50% off makes it ₹290, so shipping is charged.
    const q = (await quote([{ variantId: ids.powder500, quantity: 2 }], big)).json();
    expect(q.discount.amount).toBe(29000);
    expect(q.shipping.fee.amount).toBe(4000);
    expect(q.total.amount).toBe(29000 + 4000);
  });

  it('honours a total usage limit and first-order-only', async () => {
    const lim = code('LIM');
    await make({ code: lim, usageLimit: 1 });
    const a = await readyCustomer(t);
    const b = await readyCustomer(t);
    expect((await place(a, [{ variantId: ids.powder500, quantity: 1 }], lim)).statusCode).toBe(201);
    const second = await place(b, [{ variantId: ids.powder500, quantity: 1 }], lim);
    expect(second.statusCode).toBe(422);
    expect(second.json().detail).toBe('This code has been fully used.');

    const first = code('NEW');
    await make({ code: first, firstOrderOnly: true });
    const buyer = await readyCustomer(t);
    const o = await place(buyer, [{ variantId: ids.powder500, quantity: 1 }]);
    await t.app.inject({ method: 'POST', url: `/v1/dev/payments/${o.json().payment.id}/simulate`, headers: buyer.headers, payload: { outcome: 'success' } });
    expect((await quote([{ variantId: ids.powder500, quantity: 1 }], first, buyer.headers)).json().couponError).toBe('This code is for first orders only.');
    const newcomer = await readyCustomer(t);
    expect((await place(newcomer, [{ variantId: ids.powder500, quantity: 1 }], first)).statusCode).toBe(201);
  });

  it('is managed by staff with pricing permission only', async () => {
    const support = await staffHeaders(t, 'support');
    const denied = await t.app.inject({ method: 'POST', url: '/v1/admin/coupons', headers: support, payload: { code: code('NO'), kind: 'percent', percentBps: 500 } });
    expect(denied.statusCode).toBe(403);
    const bad = await t.app.inject({ method: 'POST', url: '/v1/admin/coupons', headers: admin, payload: { code: 'bad code!', kind: 'percent', percentBps: 500 } });
    expect(bad.statusCode).toBe(400);
    const dup = code('DUP');
    await make({ code: dup });
    expect((await t.app.inject({ method: 'POST', url: '/v1/admin/coupons', headers: admin, payload: { code: dup, kind: 'percent', percentBps: 500 } })).statusCode).toBe(409);
    const list = (await t.app.inject({ url: '/v1/admin/coupons', headers: support })).json().data;
    expect(list.find((x: { code: string }) => x.code === dup)).toMatchObject({ used: 0, status: 'active' });
  });
});
