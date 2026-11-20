import { firstOpenDate, newId } from '@dairy/core';
import { schema as s } from '@dairy/db';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runCutoff } from '../src/services/cutoff';
import { catalogIds, createTestApp, googleIdToken, readyCustomer, uniq, type TestApp } from './helpers';

let t: TestApp;
beforeAll(async () => {
  t = await createTestApp();
});
afterAll(() => t.close());

async function subscribe(c: Awaited<ReturnType<typeof readyCustomer>>, quantity: number, date: string) {
  const ids = await catalogIds(t);
  const res = await t.app.inject({
    method: 'POST',
    url: '/v1/store/subscriptions',
    headers: { ...c.headers, 'idempotency-key': crypto.randomUUID() },
    payload: { addressId: c.addressId, slotId: ids.slotId, pattern: 'daily', startsOn: date, items: [{ variantId: ids.toned500, quantity }] },
  });
  expect(res.statusCode).toBe(201);
  return res.json();
}

describe('cutoff job', () => {
  it('creates deliveries, charges wallets once, skips low balances and assigns routes', async () => {
    const date = firstOpenDate({ startsAt: '05:00', cutoffOffsetMinutes: -420 }, t.now);
    const ids = await catalogIds(t);
    const rich = await readyCustomer(t, 50_000);
    const poor = await readyCustomer(t, 1_000);
    await subscribe(rich, 2, date);
    await subscribe(poor, 1, date);

    const stats = await runCutoff(t.db, { date, slotId: ids.slotId });
    expect(stats.scheduled).toBeGreaterThanOrEqual(1);
    expect(stats.skippedLowBalance).toBeGreaterThanOrEqual(1);

    const richDelivery = (await t.db.select().from(s.deliveries).where(and(eq(s.deliveries.customerId, rich.customerId), eq(s.deliveries.deliveryDate, date))))[0]!;
    expect(richDelivery).toMatchObject({ status: 'scheduled', chargePaise: 5600 });
    expect(richDelivery.runId).not.toBeNull();
    const poorDelivery = (await t.db.select().from(s.deliveries).where(eq(s.deliveries.customerId, poor.customerId)))[0]!;
    expect(poorDelivery).toMatchObject({ status: 'skipped_low_balance', chargePaise: 0 });

    const wallet = async () => (await t.app.inject({ url: '/v1/store/wallet', headers: rich.headers })).json().balance.amount;
    expect(await wallet()).toBe(50_000 - 5600);

    // Re-running never double-charges and keeps one delivery per customer, address, date and slot.
    await runCutoff(t.db, { date, slotId: ids.slotId });
    expect(await wallet()).toBe(50_000 - 5600);
    const rows = await t.db.select().from(s.deliveries).where(eq(s.deliveries.customerId, rich.customerId));
    expect(rows).toHaveLength(1);

    // Stock was reserved FEFO and a production plan exists.
    const [allocation] = await t.db
      .select()
      .from(s.deliveryAllocations)
      .innerJoin(s.deliveryItems, eq(s.deliveryItems.id, s.deliveryAllocations.deliveryItemId))
      .where(eq(s.deliveryItems.deliveryId, richDelivery.id));
    expect(allocation?.delivery_allocations.quantity).toBe(2);
    const plan = (await t.db.select().from(s.productionPlans).where(eq(s.productionPlans.deliveryDate, date)))[0]!;
    expect(plan.lines.find((l) => l.variantId === ids.toned500)!.required).toBeGreaterThanOrEqual(2);

    // The customer's calendar shows the locked delivery with its charge.
    const cal = (await t.app.inject({ url: `/v1/store/calendar?month=${date.slice(0, 7)}`, headers: rich.headers })).json();
    expect(cal.days.find((d: { date: string }) => d.date === date)).toMatchObject({ state: 'scheduled', charge: { amount: 5600 }, editable: false });
    const ledger = (await t.app.inject({ url: '/v1/store/wallet/ledger', headers: rich.headers })).json();
    expect(ledger.data[0]).toMatchObject({ kind: 'delivery_charge', amount: { amount: -5600 }, memo: expect.stringContaining('Toned Milk 500 ml') });
  });

  it('can be run by dispatch staff from the admin API', async () => {
    const ids = await catalogIds(t);
    const email = `ops-${uniq()}@example.in`;
    await t.db.insert(s.staff).values({ id: newId('stf'), email, name: 'Ops', role: 'ops_manager' });
    const { nonce } = (await t.app.inject({ method: 'POST', url: '/v1/auth/nonce' })).json();
    const login = await t.app.inject({
      method: 'POST',
      url: '/v1/auth/google',
      payload: { idToken: await googleIdToken({ sub: `g-${uniq()}`, email, nonce }), client: 'admin' },
    });
    const cookies = Object.fromEntries(login.cookies.map((c) => [c.name, c.value]));
    const headers = { cookie: `access_token=${cookies.access_token}; csrf_token=${cookies.csrf_token}`, 'x-csrf-token': cookies.csrf_token!, 'idempotency-key': crypto.randomUUID() };
    const date = firstOpenDate({ startsAt: '05:00', cutoffOffsetMinutes: -420 }, t.now);
    const res = await t.app.inject({ method: 'POST', url: '/v1/admin/dispatch/cutoff-runs', headers, payload: { date, slotId: ids.slotId } });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('completed');
    const board = (await t.app.inject({ url: `/v1/admin/dispatch?date=${date}&slotId=${ids.slotId}`, headers })).json();
    expect(board.cutoff.status).toBe('completed');
    expect(board.runs.length).toBeGreaterThan(0);
    const me = (await t.app.inject({ url: '/v1/admin/me', headers })).json();
    expect(me).toMatchObject({ role: 'ops_manager', permissions: expect.arrayContaining(['dispatch.manage']) });
    expect((await t.app.inject({ url: '/v1/admin/slots', headers })).json().data[0].code).toBe('morning');
    const plan = (await t.app.inject({ url: `/v1/admin/production-plan?date=${date}&slotId=${ids.slotId}`, headers })).json();
    expect(plan.lines[0].name).toBeTruthy();
  });
});
