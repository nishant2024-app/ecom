import { addDays, allocateFefo, newId, type BatchStock, type BusinessDate } from '@dairy/core';
import { schema as s, type DbOrTx } from '@dairy/db';
import { and, asc, eq, gte, inArray, sql } from 'drizzle-orm';
import { AppError } from '../lib/errors';

/** Stock must have at least this many days of shelf life left when it leaves the warehouse. */
export const MIN_SHELF_DAYS = 7;

/** Sellable units per variant: on hand − reserved, in active batches that won't expire too soon. */
export async function availability(db: DbOrTx, variantIds: string[], today: BusinessDate): Promise<Map<string, number>> {
  if (variantIds.length === 0) return new Map();
  const rows = await db
    .select({ variantId: s.batches.variantId, available: sql<number>`coalesce(sum(${s.batches.onHand} - ${s.batches.reserved}), 0)::int` })
    .from(s.batches)
    .where(and(inArray(s.batches.variantId, [...new Set(variantIds)]), eq(s.batches.status, 'active'), gte(s.batches.expiresOn, addDays(today, MIN_SHELF_DAYS))))
    .groupBy(s.batches.variantId);
  return new Map(rows.map((r) => [r.variantId, Number(r.available)]));
}

/**
 * Reserve stock for order items, first-expiry-first-out, with row locks so two checkouts
 * can't sell the same unit. Throws OUT_OF_STOCK if any item can't be fully reserved.
 */
export async function reserve(
  tx: DbOrTx,
  items: { orderItemId: string; variantId: string; quantity: number; name: string }[],
  today: BusinessDate,
  orderId: string,
) {
  const variantIds = [...new Set(items.map((i) => i.variantId))];
  const rows = await tx
    .select()
    .from(s.batches)
    .where(and(inArray(s.batches.variantId, variantIds), eq(s.batches.status, 'active'), gte(s.batches.expiresOn, addDays(today, MIN_SHELF_DAYS))))
    .orderBy(asc(s.batches.expiresOn), asc(s.batches.id))
    .for('update');
  const pool = new Map<string, BatchStock[]>();
  for (const b of rows) {
    const list = pool.get(b.variantId) ?? [];
    list.push({ id: b.id, expiresOn: b.expiresOn, available: b.onHand - b.reserved });
    pool.set(b.variantId, list);
  }
  const short: string[] = [];
  const plan: { orderItemId: string; batchId: string; quantity: number }[] = [];
  for (const item of items) {
    const batches = pool.get(item.variantId) ?? [];
    // minShelf is applied in the query; allocate from today so every listed batch is usable.
    const result = allocateFefo(batches, item.quantity, today, 0);
    if (result.shortfall > 0) short.push(item.name);
    for (const a of result.allocations) {
      batches.find((b) => b.id === a.batchId)!.available -= a.quantity;
      plan.push({ orderItemId: item.orderItemId, ...a });
    }
  }
  if (short.length) throw new AppError('OUT_OF_STOCK', 422, `Not enough stock for ${short.join(', ')}`);
  for (const p of plan) {
    await tx.insert(s.orderAllocations).values({ orderItemId: p.orderItemId, batchId: p.batchId, quantity: p.quantity, status: 'reserved' });
    await tx.update(s.batches).set({ reserved: sql`${s.batches.reserved} + ${p.quantity}` }).where(eq(s.batches.id, p.batchId));
    await tx.insert(s.stockMovements).values({ id: newId('stm'), batchId: p.batchId, kind: 'reserved', quantity: p.quantity, referenceType: 'order', referenceId: orderId });
  }
}

async function allocationsFor(tx: DbOrTx, orderId: string, status: 'reserved' | 'shipped') {
  return tx
    .select({ orderItemId: s.orderAllocations.orderItemId, batchId: s.orderAllocations.batchId, quantity: s.orderAllocations.quantity })
    .from(s.orderAllocations)
    .innerJoin(s.orderItems, eq(s.orderItems.id, s.orderAllocations.orderItemId))
    .where(and(eq(s.orderItems.orderId, orderId), eq(s.orderAllocations.status, status)));
}

/** Give reserved stock back (cancel, expiry). */
export async function release(tx: DbOrTx, orderId: string, actor: { type: string; id?: string | null } = { type: 'system' }) {
  for (const a of await allocationsFor(tx, orderId, 'reserved')) {
    await tx.update(s.batches).set({ reserved: sql`${s.batches.reserved} - ${a.quantity}` }).where(eq(s.batches.id, a.batchId));
    await tx
      .update(s.orderAllocations)
      .set({ status: 'released' })
      .where(and(eq(s.orderAllocations.orderItemId, a.orderItemId), eq(s.orderAllocations.batchId, a.batchId)));
    await tx.insert(s.stockMovements).values({ id: newId('stm'), batchId: a.batchId, kind: 'released', quantity: a.quantity, referenceType: 'order', referenceId: orderId, createdByType: actor.type, createdById: actor.id ?? null });
  }
}

/** Reserved stock leaves the warehouse: on hand and reserved both go down. */
export async function ship(tx: DbOrTx, orderId: string, actor: { type: string; id?: string | null }) {
  for (const a of await allocationsFor(tx, orderId, 'reserved')) {
    await tx
      .update(s.batches)
      .set({ onHand: sql`${s.batches.onHand} - ${a.quantity}`, reserved: sql`${s.batches.reserved} - ${a.quantity}` })
      .where(eq(s.batches.id, a.batchId));
    await tx
      .update(s.orderAllocations)
      .set({ status: 'shipped' })
      .where(and(eq(s.orderAllocations.orderItemId, a.orderItemId), eq(s.orderAllocations.batchId, a.batchId)));
    await tx.insert(s.stockMovements).values({ id: newId('stm'), batchId: a.batchId, kind: 'shipped', quantity: a.quantity, referenceType: 'order', referenceId: orderId, createdByType: actor.type, createdById: actor.id ?? null });
  }
}
