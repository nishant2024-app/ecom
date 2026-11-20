import { firstOpenDate } from '@dairy/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { catalogIds, createTestApp, readyCustomer, signInAndroid, type TestApp } from './helpers';

let t: TestApp;
beforeAll(async () => {
  t = await createTestApp();
});
afterAll(() => t.close());

describe('catalog', () => {
  it('checks serviceability by pincode and by map pin', async () => {
    const byPin = (await t.app.inject('/v1/store/serviceability?pincode=411045')).json();
    expect(byPin).toMatchObject({ serviceable: true, zone: { name: 'Baner – Balewadi' } });
    expect(byPin.slots[0]).toMatchObject({ code: 'morning', label: '5–8 AM' });
    expect((await t.app.inject('/v1/store/serviceability?lat=18.559&lng=73.7868')).json().serviceable).toBe(true);
    expect((await t.app.inject('/v1/store/serviceability?pincode=110001')).json()).toMatchObject({ serviceable: false, slots: [] });
    expect((await t.app.inject('/v1/store/serviceability')).json().code).toBe('VALIDATION_FAILED');
  });

  it('lists products with money in paise and searches Hinglish terms', async () => {
    const all = (await t.app.inject('/v1/store/products')).json();
    expect(all.data.length).toBeGreaterThanOrEqual(8);
    const toned = all.data.find((p: { slug: string }) => p.slug === 'toned-milk');
    expect(toned.variants[0].price).toEqual({ amount: 3000, currency: 'INR' });
    const doodh = (await t.app.inject('/v1/store/products?q=doodh')).json().data.map((p: { slug: string }) => p.slug);
    expect(doodh).toContain('toned-milk');
    expect(doodh).not.toContain('malai-paneer');
    const makhan = (await t.app.inject('/v1/store/products?q=makhan')).json().data.map((p: { slug: string }) => p.slug);
    expect(makhan).toEqual(['white-butter']);
  });

  it('localises names with Accept-Language: hi', async () => {
    const res = await t.app.inject({ url: '/v1/store/products/toned-milk', headers: { 'accept-language': 'hi' } });
    expect(res.json()).toMatchObject({ name: 'टोंड दूध', hsnCode: '0401' });
    expect((await t.app.inject('/v1/store/products/nope')).statusCode).toBe(404);
  });

  it('lists open delivery dates with IST cutoffs', async () => {
    const zone = (await t.app.inject('/v1/store/serviceability?pincode=411045')).json().zone.id;
    const res = (await t.app.inject(`/v1/store/delivery-slots?zoneId=${zone}&days=3`)).json();
    expect(res.data[0].dates.length).toBeGreaterThan(0);
    expect(res.data[0].dates[0].cutoffAt).toMatch(/T16:30:00.000Z$/); // 22:00 IST
  });
});

describe('profile and addresses', () => {
  it('normalises Indian mobile numbers and rejects bad ones', async () => {
    const u = await signInAndroid(t.app);
    const ok = await t.app.inject({ method: 'PATCH', url: '/v1/store/me', headers: u.headers, payload: { phone: '098765 43210' } });
    expect(ok.json().phone).toBe('+919876543210');
    const bad = await t.app.inject({ method: 'PATCH', url: '/v1/store/me', headers: u.headers, payload: { phone: '12345' } });
    expect(bad.json().errors[0].field).toBe('/phone');
  });

  it('accepts serviceable addresses, rejects others, and makes the first one default', async () => {
    const u = await signInAndroid(t.app);
    const outside = await t.app.inject({
      method: 'POST',
      url: '/v1/store/me/addresses',
      headers: u.headers,
      payload: { line1: 'Connaught Place', city: 'Delhi', state: 'Delhi', pincode: '110001' },
    });
    expect(outside.json().code).toBe('NOT_SERVICEABLE');
    const inside = await t.app.inject({
      method: 'POST',
      url: '/v1/store/me/addresses',
      headers: u.headers,
      payload: { line1: 'Flat 2, Aundh Road', city: 'Pune', state: 'Maharashtra', pincode: '411007', location: { lat: 18.56, lng: 73.81 } },
    });
    expect(inside.statusCode).toBe(201);
    expect(inside.json()).toMatchObject({ isDefault: true, location: { lat: 18.56, lng: 73.81 } });
    expect((await t.app.inject({ url: '/v1/store/me', headers: u.headers })).json().profileComplete).toBe(false); // no phone yet
  });
});

describe('subscriptions and the milk card', () => {
  it('creates a subscription, shows it on the calendar, pauses and overrides days', async () => {
    const c = await readyCustomer(t);
    const ids = await catalogIds(t);
    const slot = { startsAt: '05:00', cutoffOffsetMinutes: -420 };
    const start = firstOpenDate(slot, t.now);

    const create = (key: string) =>
      t.app.inject({
        method: 'POST',
        url: '/v1/store/subscriptions',
        headers: { ...c.headers, 'idempotency-key': key },
        payload: { addressId: c.addressId, slotId: ids.slotId, pattern: 'daily', startsOn: start, items: [{ variantId: ids.toned500, quantity: 2 }] },
      });
    const res = await create('11111111-aaaa-4bbb-8ccc-000000000001');
    expect(res.statusCode).toBe(201);
    const sub = res.json();
    expect(sub).toMatchObject({ status: 'active', nextDelivery: { date: start } });
    expect(sub.items[0].unitPrice).toEqual({ amount: 2800, currency: 'INR' });
    expect(sub.estimatedMonthly.amount).toBe(30 * 2 * 2800);

    // Same key + same body replays; same key + different body is rejected.
    const replay = await create('11111111-aaaa-4bbb-8ccc-000000000001');
    expect(replay.headers['idempotent-replayed']).toBe('true');
    expect(replay.json().id).toBe(sub.id);
    const list = (await t.app.inject({ url: '/v1/store/subscriptions', headers: c.headers })).json();
    expect(list.data).toHaveLength(1);

    const month = start.slice(0, 7);
    const cal = (await t.app.inject({ url: `/v1/store/calendar?month=${month}`, headers: c.headers })).json();
    const day = cal.days.find((d: { date: string }) => d.date === start);
    expect(day).toMatchObject({ state: 'planned', editable: true, items: [{ quantity: 2 }], estimatedCharge: { amount: 5600 } });

    // Override the first day to 4, pause from the next day for 3 days.
    const override = await t.app.inject({
      method: 'PUT',
      url: `/v1/store/subscriptions/${sub.id}/overrides/${start}`,
      headers: c.headers,
      payload: { items: [{ variantId: ids.toned500, quantity: 4 }] },
    });
    expect(override.json()).toMatchObject({ items: [{ quantity: 4 }] });

    const { addDays } = await import('@dairy/core');
    const pause = await t.app.inject({
      method: 'POST',
      url: `/v1/store/subscriptions/${sub.id}/pauses`,
      headers: c.headers,
      payload: { startsOn: addDays(start, 1), endsOn: addDays(start, 3) },
    });
    expect(pause.statusCode).toBe(201);
    const paused = (await t.app.inject({ url: `/v1/store/calendar?month=${addDays(start, 2).slice(0, 7)}`, headers: c.headers })).json();
    expect(paused.days.find((d: { date: string }) => d.date === addDays(start, 2)).state).toBe('paused');

    // A pause that starts before the first open date is refused.
    const late = await t.app.inject({
      method: 'POST',
      url: `/v1/store/subscriptions/${sub.id}/pauses`,
      headers: c.headers,
      payload: { startsOn: addDays(start, -1), endsOn: start },
    });
    expect(late.json().code).toBe('CUTOFF_PASSED');
  });

  it('requires a phone number, valid items and a future start', async () => {
    const ids = await catalogIds(t);
    const noPhone = await signInAndroid(t.app);
    const addr = await t.app.inject({
      method: 'POST',
      url: '/v1/store/me/addresses',
      headers: noPhone.headers,
      payload: { line1: 'B-1 Baner', city: 'Pune', state: 'Maharashtra', pincode: '411045' },
    });
    const body = { addressId: addr.json().id, slotId: ids.slotId, pattern: 'daily', startsOn: '2099-01-01', items: [{ variantId: ids.toned500, quantity: 1 }] };
    const r1 = await t.app.inject({ method: 'POST', url: '/v1/store/subscriptions', headers: { ...noPhone.headers, 'idempotency-key': crypto.randomUUID() }, payload: body });
    expect(r1.json().code).toBe('PROFILE_INCOMPLETE');

    const c = await readyCustomer(t);
    const past = await t.app.inject({
      method: 'POST',
      url: '/v1/store/subscriptions',
      headers: { ...c.headers, 'idempotency-key': crypto.randomUUID() },
      payload: { ...body, addressId: c.addressId, startsOn: '2020-01-01' },
    });
    expect(past.json().code).toBe('CUTOFF_PASSED');
    const paneer = await t.app.inject({
      method: 'POST',
      url: '/v1/store/subscriptions',
      headers: { ...c.headers, 'idempotency-key': crypto.randomUUID() },
      payload: { ...body, addressId: c.addressId, items: [{ variantId: ids.paneer200, quantity: 1 }] },
    });
    expect(paneer.json().code).toBe('PRODUCT_UNAVAILABLE');
    const noKey = await t.app.inject({ method: 'POST', url: '/v1/store/subscriptions', headers: c.headers, payload: { ...body, addressId: c.addressId } });
    expect(noKey.statusCode).toBe(400);
  });

  it('shows wallet balance, projection and ledger', async () => {
    const c = await readyCustomer(t, 20_000);
    const ids = await catalogIds(t);
    const start = firstOpenDate({ startsAt: '05:00', cutoffOffsetMinutes: -420 }, t.now);
    await t.app.inject({
      method: 'POST',
      url: '/v1/store/subscriptions',
      headers: { ...c.headers, 'idempotency-key': crypto.randomUUID() },
      payload: { addressId: c.addressId, slotId: ids.slotId, pattern: 'daily', startsOn: start, items: [{ variantId: ids.toned500, quantity: 1 }] },
    });
    const wallet = (await t.app.inject({ url: '/v1/store/wallet', headers: c.headers })).json();
    expect(wallet.balance).toEqual({ amount: 20_000, currency: 'INR' });
    expect(wallet.projected.next7Days.amount).toBeGreaterThan(0);
    expect(wallet.projected.runsOutOn).not.toBeNull(); // ₹200 lasts about 7 days at ₹28/day
    const ledger = (await t.app.inject({ url: '/v1/store/wallet/ledger', headers: c.headers })).json();
    expect(ledger.data[0]).toMatchObject({ kind: 'topup', amount: { amount: 20_000 }, balanceAfter: { amount: 20_000 } });
  });
});
