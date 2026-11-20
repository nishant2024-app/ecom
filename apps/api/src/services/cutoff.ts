import {
  addDays,
  allocateFefo,
  newId,
  planDeliveries,
  postings,
  productionNeed,
  type BatchStock,
  type BusinessDate,
  type PlanOrderLine,
  type PlanSubscription,
} from '@dairy/core';
import { schema as s, type Db, type DbOrTx } from '@dairy/db';
import { and, asc, eq, gte, inArray, isNotNull, isNull, lte, ne, or, sql } from 'drizzle-orm';
import { getSlot, holidaySet } from './store';
import { loadSubscriptions, variantInfo } from './subscriptions';
import { postToWallet } from './wallet';

export interface CutoffStats {
  deliveries: number;
  scheduled: number;
  skippedLowBalance: number;
  frozen: number;
  chargedPaise: number;
  units: number;
  shortfalls: Record<string, number>;
}

const FROZEN = new Set(['packed', 'out_for_delivery', 'delivered', 'not_available', 'refused', 'missed', 'cancelled']);

export class CutoffBusyError extends Error {}

/**
 * The nightly cutoff job (docs/06-business-rules.md#cutoff-job). Safe to re-run:
 * deliveries are upserted by (customer, address, date, slot), wallet charges are keyed by
 * delivery, and deliveries that already left the scheduled state are never touched.
 */
export async function runCutoff(db: Db, input: { date: BusinessDate; slotId: string; now?: Date }): Promise<CutoffStats> {
  const slot = await getSlot(db, input.slotId);
  const runId = newId('cor');
  await db.insert(s.cutoffRuns).values({ id: runId, sellerId: slot.sellerId, deliveryDate: input.date, slotId: slot.id, status: 'running' });
  try {
    const stats = await db.transaction(async (tx) => {
      const [lock] = await tx.execute<{ ok: boolean }>(
        sql`select pg_try_advisory_xact_lock(hashtext(${`cutoff:${slot.sellerId}:${input.date}:${slot.id}`})) as ok`,
      );
      if (!lock?.ok) throw new CutoffBusyError('another cutoff run for this date and slot is in progress');
      return execute(tx, slot.sellerId, slot.id, input.date, runId);
    });
    await db.update(s.cutoffRuns).set({ status: 'completed', stats, finishedAt: new Date() }).where(eq(s.cutoffRuns.id, runId));
    return stats;
  } catch (err) {
    await db
      .update(s.cutoffRuns)
      .set({ status: 'failed', error: err instanceof Error ? err.message : String(err), finishedAt: new Date() })
      .where(eq(s.cutoffRuns.id, runId));
    throw err;
  }
}

async function execute(tx: DbOrTx, sellerId: string, slotId: string, date: BusinessDate, runId: string): Promise<CutoffStats> {
  const holidays = await holidaySet(tx, sellerId, slotId, date, date);

  // 1. Subscriptions that may deliver on this date.
  const subRows = await tx
    .select()
    .from(s.subscriptions)
    .where(
      and(
        eq(s.subscriptions.slotId, slotId),
        lte(s.subscriptions.startsOn, date),
        or(isNull(s.subscriptions.endsOn), gte(s.subscriptions.endsOn, date)),
        or(eq(s.subscriptions.status, 'active'), and(eq(s.subscriptions.status, 'cancelled'), isNotNull(s.subscriptions.endsOn))),
      ),
    );
  const subs = await loadSubscriptions(tx, subRows, { from: date, to: date });

  // 2. Confirmed one-time orders.
  const orderRows = await tx
    .select()
    .from(s.orders)
    .where(and(eq(s.orders.deliveryDate, date), eq(s.orders.slotId, slotId), inArray(s.orders.status, ['confirmed', 'scheduled'])));
  const orderItemRows = orderRows.length
    ? await tx.select().from(s.orderItems).where(inArray(s.orderItems.orderId, orderRows.map((o) => o.id)))
    : [];

  // 3. Existing deliveries (re-runs).
  const existing = await tx.select().from(s.deliveries).where(and(eq(s.deliveries.deliveryDate, date), eq(s.deliveries.slotId, slotId)));
  const existingByKey = new Map(existing.map((d) => [`${d.customerId}|${d.addressId}`, d]));
  const frozenKeys = new Set(existing.filter((d) => FROZEN.has(d.status)).map((d) => `${d.customerId}|${d.addressId}`));

  // 4. Wallets. Add back charges already posted for this date so a re-run plans the same way.
  const customerIds = [...new Set([...subs.map((x) => x.row.customerId), ...orderRows.map((o) => o.customerId)])];
  const wallets = customerIds.length ? await tx.select().from(s.wallets).where(inArray(s.wallets.customerId, customerIds)) : [];
  const walletByCustomer = new Map(wallets.map((w) => [w.customerId, w]));
  const alreadyCharged = new Map<string, number>();
  for (const d of existing) alreadyCharged.set(d.customerId, (alreadyCharged.get(d.customerId) ?? 0) + d.chargePaise);

  const info = await variantInfo(tx, [
    ...subs.flatMap((x) => x.items.map((i) => i.variantId)),
    ...subs.flatMap((x) => [...x.overrides.values()].flat().map((i) => i.variantId)),
  ]);

  const planSubs: PlanSubscription[] = subs.map((x) => ({ ...x.spec, id: x.row.id, customerId: x.row.customerId, addressId: x.row.addressId }));
  const planOrders: PlanOrderLine[] = orderItemRows.map((i) => {
    const o = orderRows.find((r) => r.id === i.orderId)!;
    return { orderId: o.id, customerId: o.customerId, addressId: o.addressId, variantId: i.variantId, quantity: i.quantity, unitPricePaise: i.unitPricePaise };
  });
  const plans = planDeliveries({
    date,
    subscriptions: planSubs,
    orderLines: planOrders,
    holidays,
    subscriptionPrice: (id) => info.get(id)?.subscriptionPricePaise ?? 0,
    wallet: (customerId) => {
      const w = walletByCustomer.get(customerId);
      return {
        balancePaise: (w?.balancePaise ?? 0) + (alreadyCharged.get(customerId) ?? 0),
        overdraftLimitPaise: w?.overdraftLimitPaise ?? 0,
      };
    },
  });

  const stats: CutoffStats = { deliveries: 0, scheduled: 0, skippedLowBalance: 0, frozen: frozenKeys.size, chargedPaise: 0, units: 0, shortfalls: {} };
  const now = new Date();
  const touched: { deliveryId: string; addressId: string; items: { id: string; variantId: string; quantity: number }[] }[] = [];

  for (const plan of plans) {
    const key = `${plan.customerId}|${plan.addressId}`;
    if (frozenKeys.has(key)) continue;
    const prev = existingByKey.get(key);
    const deliveryId = prev?.id ?? newId('dlv');

    if (prev) await releaseAllocations(tx, prev.id, runId);
    if (prev) await tx.delete(s.deliveryItems).where(eq(s.deliveryItems.deliveryId, prev.id));

    await tx
      .insert(s.deliveries)
      .values({
        id: deliveryId,
        customerId: plan.customerId,
        sellerId,
        addressId: plan.addressId,
        deliveryDate: date,
        slotId,
        status: plan.status,
        chargePaise: prev?.chargePaise ?? 0,
      })
      .onConflictDoUpdate({
        target: [s.deliveries.customerId, s.deliveries.addressId, s.deliveries.deliveryDate, s.deliveries.slotId],
        set: { status: plan.status, updatedAt: now },
      });

    const itemRows = plan.items.map((i) => ({
      id: newId('dli'),
      deliveryId,
      variantId: i.variantId,
      quantity: i.quantity,
      unitPricePaise: i.unitPricePaise,
      source: i.source,
      subscriptionId: i.subscriptionId ?? null,
      orderId: i.orderId ?? null,
    }));
    if (itemRows.length) await tx.insert(s.deliveryItems).values(itemRows);

    if (plan.chargePaise > 0) {
      const wallet = walletByCustomer.get(plan.customerId);
      if (wallet) {
        const units = plan.items.filter((i) => i.source === 'subscription').map((i) => `${i.quantity} × ${info.get(i.variantId)?.name ?? i.variantId}`);
        const posted = await postToWallet(tx, wallet.id, postings.deliveryCharge(plan.chargePaise), { type: 'delivery', id: deliveryId }, `Delivery ${date} · ${units.join(', ')}`);
        if (posted) {
          await tx.update(s.deliveries).set({ chargePaise: plan.chargePaise, chargedAt: now }).where(eq(s.deliveries.id, deliveryId));
          stats.chargedPaise += plan.chargePaise;
        }
      }
    }

    const orderIds = [...new Set(plan.items.flatMap((i) => (i.orderId ? [i.orderId] : [])))];
    for (const orderId of orderIds) {
      const updated = await tx
        .update(s.orders)
        .set({ status: 'scheduled' })
        .where(and(eq(s.orders.id, orderId), eq(s.orders.status, 'confirmed')))
        .returning({ id: s.orders.id });
      if (updated.length) {
        await tx.insert(s.orderEvents).values({ id: newId('oev'), orderId, type: 'scheduled', fromStatus: 'confirmed', toStatus: 'scheduled', actorType: 'system', data: { deliveryId } });
      }
    }

    stats.deliveries++;
    if (plan.status === 'scheduled') stats.scheduled++;
    else stats.skippedLowBalance++;
    stats.units += plan.items.reduce((n, i) => n + i.quantity, 0);
    touched.push({ deliveryId, addressId: plan.addressId, items: itemRows.map((r) => ({ id: r.id, variantId: r.variantId, quantity: r.quantity })) });
  }

  await allocateStock(tx, sellerId, date, runId, touched, stats);
  await assignRoutes(tx, date, slotId, touched);
  await writeProductionPlan(tx, sellerId, date, slotId);
  return stats;
}

async function releaseAllocations(tx: DbOrTx, deliveryId: string, runId: string) {
  const allocations = await tx
    .select({ batchId: s.deliveryAllocations.batchId, quantity: s.deliveryAllocations.quantity })
    .from(s.deliveryAllocations)
    .innerJoin(s.deliveryItems, eq(s.deliveryItems.id, s.deliveryAllocations.deliveryItemId))
    .where(eq(s.deliveryItems.deliveryId, deliveryId));
  for (const a of allocations) {
    await tx.update(s.batches).set({ reserved: sql`${s.batches.reserved} - ${a.quantity}` }).where(eq(s.batches.id, a.batchId));
    await tx.insert(s.stockMovements).values({ id: newId('stm'), batchId: a.batchId, kind: 'released', quantity: a.quantity, referenceType: 'cutoff_run', referenceId: runId });
  }
}

async function allocateStock(
  tx: DbOrTx,
  sellerId: string,
  date: BusinessDate,
  runId: string,
  touched: { deliveryId: string; items: { id: string; variantId: string; quantity: number }[] }[],
  stats: CutoffStats,
) {
  const variantIds = [...new Set(touched.flatMap((t) => t.items.map((i) => i.variantId)))];
  if (variantIds.length === 0) return;
  const rows = await tx
    .select()
    .from(s.batches)
    .where(and(eq(s.batches.sellerId, sellerId), inArray(s.batches.variantId, variantIds), eq(s.batches.status, 'active'), gte(s.batches.expiresOn, addDays(date, 1))))
    .orderBy(asc(s.batches.expiresOn))
    .for('update');
  const pool = new Map<string, BatchStock[]>();
  for (const b of rows) {
    const list = pool.get(b.variantId) ?? [];
    list.push({ id: b.id, expiresOn: b.expiresOn, available: b.onHand - b.reserved });
    pool.set(b.variantId, list);
  }
  const reservedByBatch = new Map<string, number>();
  for (const t of touched) {
    for (const item of t.items) {
      const batches = pool.get(item.variantId) ?? [];
      const result = allocateFefo(batches, item.quantity, date);
      for (const a of result.allocations) {
        const b = batches.find((x) => x.id === a.batchId)!;
        b.available -= a.quantity;
        reservedByBatch.set(a.batchId, (reservedByBatch.get(a.batchId) ?? 0) + a.quantity);
        await tx.insert(s.deliveryAllocations).values({ deliveryItemId: item.id, batchId: a.batchId, quantity: a.quantity });
      }
      if (result.shortfall > 0) stats.shortfalls[item.variantId] = (stats.shortfalls[item.variantId] ?? 0) + result.shortfall;
    }
  }
  for (const [batchId, quantity] of reservedByBatch) {
    await tx.update(s.batches).set({ reserved: sql`${s.batches.reserved} + ${quantity}` }).where(eq(s.batches.id, batchId));
    await tx.insert(s.stockMovements).values({ id: newId('stm'), batchId, kind: 'reserved', quantity, referenceType: 'cutoff_run', referenceId: runId });
  }
}

async function assignRoutes(tx: DbOrTx, date: BusinessDate, slotId: string, touched: { deliveryId: string; addressId: string }[]) {
  if (touched.length === 0) return;
  const addressIds = [...new Set(touched.map((t) => t.addressId))];
  const stops = await tx.select().from(s.routeStops).where(inArray(s.routeStops.addressId, addressIds));
  const stopByAddress = new Map(stops.map((st) => [st.addressId, st]));
  const addresses = await tx.select({ id: s.addresses.id, zoneId: s.addresses.zoneId }).from(s.addresses).where(inArray(s.addresses.id, addressIds));

  for (const a of addresses) {
    if (stopByAddress.has(a.id) || !a.zoneId) continue;
    const [route] = await tx.select().from(s.routes).where(eq(s.routes.zoneId, a.zoneId)).orderBy(asc(s.routes.name)).limit(1);
    if (!route) continue;
    const [{ max } = { max: 0 }] = await tx.execute<{ max: number }>(sql`select coalesce(max(sequence), 0)::int as max from route_stops where route_id = ${route.id}`);
    const stop = { routeId: route.id, addressId: a.id, sequence: Number(max) + 1 };
    await tx.insert(s.routeStops).values(stop).onConflictDoNothing();
    stopByAddress.set(a.id, stop);
  }

  const runByRoute = new Map<string, string>();
  for (const t of touched) {
    const stop = stopByAddress.get(t.addressId);
    if (!stop) continue;
    let runId = runByRoute.get(stop.routeId);
    if (!runId) {
      const [route] = await tx.select().from(s.routes).where(eq(s.routes.id, stop.routeId));
      const [run] = await tx
        .insert(s.runs)
        .values({ id: newId('run'), routeId: stop.routeId, agentId: route?.defaultAgentId ?? null, deliveryDate: date, slotId })
        .onConflictDoUpdate({ target: [s.runs.routeId, s.runs.deliveryDate, s.runs.slotId], set: { routeId: stop.routeId } })
        .returning({ id: s.runs.id });
      runId = run!.id;
      runByRoute.set(stop.routeId, runId);
    }
    await tx.update(s.deliveries).set({ runId, stopSequence: stop.sequence }).where(eq(s.deliveries.id, t.deliveryId));
  }
}

async function writeProductionPlan(tx: DbOrTx, sellerId: string, date: BusinessDate, slotId: string) {
  const required = await tx
    .select({ variantId: s.deliveryItems.variantId, units: sql<number>`sum(${s.deliveryItems.quantity})::int` })
    .from(s.deliveryItems)
    .innerJoin(s.deliveries, eq(s.deliveries.id, s.deliveryItems.deliveryId))
    .where(and(eq(s.deliveries.deliveryDate, date), eq(s.deliveries.slotId, slotId), ne(s.deliveries.status, 'cancelled')))
    .groupBy(s.deliveryItems.variantId);
  const stock = required.length
    ? await tx
        .select({ variantId: s.batches.variantId, onHand: sql<number>`sum(${s.batches.onHand})::int` })
        .from(s.batches)
        .where(and(inArray(s.batches.variantId, required.map((r) => r.variantId)), eq(s.batches.status, 'active'), gte(s.batches.expiresOn, addDays(date, 1))))
        .groupBy(s.batches.variantId)
    : [];
  const lines = required.map((r) => ({ variantId: r.variantId, ...productionNeed(Number(r.units), Number(stock.find((x) => x.variantId === r.variantId)?.onHand ?? 0)) }));
  await tx
    .insert(s.productionPlans)
    .values({ id: newId('ppl'), sellerId, deliveryDate: date, slotId, lines })
    .onConflictDoUpdate({ target: [s.productionPlans.sellerId, s.productionPlans.deliveryDate, s.productionPlans.slotId], set: { lines, generatedAt: new Date() } });
}
