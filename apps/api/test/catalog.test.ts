import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, readyCustomer, signInAndroid, variantIds, type TestApp } from './helpers';

let t: TestApp;
beforeAll(async () => {
  t = await createTestApp();
});
afterAll(() => t.close());

describe('catalog', () => {
  it('lists shelf-stable products with pack visuals, stock flags and categories', async () => {
    const res = (await t.app.inject('/v1/store/products')).json();
    expect(res.data.length).toBeGreaterThanOrEqual(12);
    const ghee = res.data.find((p: { slug: string }) => p.slug === 'a2-gir-cow-ghee');
    expect(ghee).toMatchObject({ pack: { kind: 'jar' }, featured: true, fromPrice: { amount: 115000, currency: 'INR' } });
    expect(ghee.variants[0]).toMatchObject({ inStock: true, shelfLifeDays: 270 });
    const cats = (await t.app.inject('/v1/store/categories')).json().data;
    expect(cats.map((c: { slug: string }) => c.slug)).toEqual(['ghee', 'milk-powder', 'uht-flavoured', 'condensed-sweets']);
    expect(cats[0].packs.length).toBeGreaterThan(0);
  });

  it('searches Hindi and Hinglish terms', async () => {
    const slugs = async (q: string) => (await t.app.inject(`/v1/store/products?q=${encodeURIComponent(q)}`)).json().data.map((p: { slug: string }) => p.slug);
    expect(await slugs('ghi')).toEqual(expect.arrayContaining(['a2-gir-cow-ghee', 'buffalo-ghee']));
    expect(await slugs('pedha')).toEqual(['kandi-peda']);
    expect(await slugs('doodh powder')).toContain('whole-milk-powder');
  });

  it('flags low stock and returns product detail with related items', async () => {
    const cake = (await t.app.inject('/v1/store/products/milk-cake')).json();
    expect(cake.variants[0].lowStock).toBe(true);
    const ghee = (await t.app.inject({ url: '/v1/store/products/a2-gir-cow-ghee', headers: { 'accept-language': 'hi' } })).json();
    expect(ghee).toMatchObject({ name: 'ए2 गिर गाय का घी', hsnCode: '0405' });
    expect(ghee.related.map((r: { slug: string }) => r.slug)).toContain('buffalo-ghee');
    expect((await t.app.inject('/v1/store/products/nope')).statusCode).toBe(404);
  });
});

describe('shipping and quotes', () => {
  it('estimates delivery by pincode', async () => {
    const pune = (await t.app.inject('/v1/store/shipping/estimate?pincode=411045')).json();
    expect(pune).toMatchObject({ serviceable: true, state: 'Maharashtra', shipping: { zone: 'Pune', etaMinDays: 1, fee: { amount: 4000 } }, freeAbove: { amount: 49900 } });
    const delhi = (await t.app.inject('/v1/store/shipping/estimate?pincode=110001')).json();
    expect(delhi.shipping.zone).toBe('Rest of India');
    const apo = (await t.app.inject('/v1/store/shipping/estimate?pincode=900001')).json();
    expect(apo).toMatchObject({ serviceable: false, message: 'We do not ship to this pincode yet' });
  });

  it('prices a cart from server prices with free-shipping thresholds and stock problems', async () => {
    const ids = await variantIds(t);
    const small = (await t.app.inject({ method: 'POST', url: '/v1/store/checkout/quote', payload: { lines: [{ variantId: ids.uht1l, quantity: 1 }], pincode: '411045' } })).json();
    expect(small).toMatchObject({ subtotal: { amount: 7800 }, shipping: { fee: { amount: 4000 }, free: false, remainingForFree: { amount: 42100 } }, total: { amount: 11800 }, ok: true });
    // 2 × 1.06 kg is over the 2 kg included in the fee: one extra kilogram is charged.
    const heavy = (await t.app.inject({ method: 'POST', url: '/v1/store/checkout/quote', payload: { lines: [{ variantId: ids.uht1l, quantity: 2 }], pincode: '411045' } })).json();
    expect(heavy.shipping.fee.amount).toBe(4000 + 2000);
    const big = (await t.app.inject({ method: 'POST', url: '/v1/store/checkout/quote', payload: { lines: [{ variantId: ids.ghee500, quantity: 1 }], pincode: '411045' } })).json();
    expect(big).toMatchObject({ shipping: { free: true, fee: { amount: 0 } }, total: { amount: 115000 }, taxIncluded: { amount: 5476 } });
    const tooMany = (await t.app.inject({ method: 'POST', url: '/v1/store/checkout/quote', payload: { lines: [{ variantId: ids.milkCake, quantity: 30 }] } })).json();
    expect(tooMany.lines[0].problem).toBe('over_limit');
    expect(tooMany.ok).toBe(false);
  });
});

describe('profile and addresses', () => {
  it('normalises phones, derives state from pincode, and makes the first address default', async () => {
    const c = await readyCustomer(t, '560001');
    const list = (await t.app.inject({ url: '/v1/store/me/addresses', headers: c.headers })).json().data;
    expect(list[0]).toMatchObject({ phone: '+919876543210', state: 'Karnataka', isDefault: true });
    expect((await t.app.inject({ url: '/v1/store/me', headers: c.headers })).json().profileComplete).toBe(true);
    const bad = await t.app.inject({ method: 'POST', url: '/v1/store/me/addresses', headers: c.headers, payload: { name: 'X Y', phone: '123', line1: 'Flat 1', city: 'Pune', pincode: '411045' } });
    expect(bad.json().errors[0].field).toBe('/phone');
  });

  it('starts without a profile', async () => {
    const u = await signInAndroid(t.app);
    expect((await t.app.inject({ url: '/v1/store/me', headers: u.headers })).json().profileComplete).toBe(false);
  });
});
