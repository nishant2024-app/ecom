import {
  addDays,
  estimateMonthly,
  itemsForDate,
  type BusinessDate,
  type ItemQuantity,
  type SubscriptionSpec,
} from '@dairy/core';
import { schema as s, type DbOrTx } from '@dairy/db';
import { and, eq, gte, inArray, lte } from 'drizzle-orm';
import { AppError } from '../lib/errors';

export type SubscriptionRow = typeof s.subscriptions.$inferSelect;

export interface LoadedSubscription {
  row: SubscriptionRow;
  items: (typeof s.subscriptionItems.$inferSelect)[];
  pauses: (typeof s.subscriptionPauses.$inferSelect)[];
  overrides: Map<BusinessDate, ItemQuantity[]>;
  spec: SubscriptionSpec;
}

/**
 * A cancelled subscription keeps delivering until its endsOn (set to the day before the
 * first open date when cancelled), so dates already locked are not lost.
 */
export function toSpec(row: SubscriptionRow, items: LoadedSubscription['items'], pauses: LoadedSubscription['pauses'], overrides: Map<BusinessDate, ItemQuantity[]>): SubscriptionSpec {
  const effectivelyActive = row.status === 'active' || (row.status === 'cancelled' && row.endsOn !== null);
  return {
    pattern: row.pattern as SubscriptionSpec['pattern'],
    status: effectivelyActive ? 'active' : 'cancelled',
    startsOn: row.startsOn,
    endsOn: row.endsOn,
    anchorDate: row.anchorDate,
    items: items.map((i) => ({
      variantId: i.variantId,
      ...(i.quantity !== null ? { quantity: i.quantity } : {}),
      ...(i.weekdayQuantities ? { weekdayQuantities: i.weekdayQuantities } : {}),
    })),
    pauses: pauses.map((p) => ({ startsOn: p.startsOn, endsOn: p.endsOn })),
    overrides,
  };
}

export async function loadSubscriptions(
  db: DbOrTx,
  rows: SubscriptionRow[],
  overrideRange?: { from: BusinessDate; to: BusinessDate },
): Promise<LoadedSubscription[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const [items, pauses, overrides] = await Promise.all([
    db.select().from(s.subscriptionItems).where(inArray(s.subscriptionItems.subscriptionId, ids)),
    db.select().from(s.subscriptionPauses).where(inArray(s.subscriptionPauses.subscriptionId, ids)),
    db
      .select()
      .from(s.subscriptionOverrides)
      .where(
        and(
          inArray(s.subscriptionOverrides.subscriptionId, ids),
          ...(overrideRange ? [gte(s.subscriptionOverrides.date, overrideRange.from), lte(s.subscriptionOverrides.date, overrideRange.to)] : []),
        ),
      ),
  ]);
  return rows.map((row) => {
    const its = items.filter((i) => i.subscriptionId === row.id);
    const ps = pauses.filter((p) => p.subscriptionId === row.id);
    const ov = new Map(overrides.filter((o) => o.subscriptionId === row.id).map((o) => [o.date, o.items]));
    return { row, items: its, pauses: ps, overrides: ov, spec: toSpec(row, its, ps, ov) };
  });
}

export async function getOwnedSubscription(db: DbOrTx, customerId: string, id: string): Promise<LoadedSubscription> {
  const [row] = await db.select().from(s.subscriptions).where(and(eq(s.subscriptions.id, id), eq(s.subscriptions.customerId, customerId)));
  if (!row) throw new AppError('NOT_FOUND', 404, 'Subscription not found');
  return (await loadSubscriptions(db, [row]))[0]!;
}

export interface VariantInfo {
  id: string;
  name: string;
  nameHi: string;
  packSize: string;
  pricePaise: number;
  subscriptionPricePaise: number;
  subscribable: boolean;
  status: string;
}

export async function variantInfo(db: DbOrTx, ids: string[]): Promise<Map<string, VariantInfo>> {
  if (ids.length === 0) return new Map();
  const rows = await db
    .select({ v: s.productVariants, p: s.products })
    .from(s.productVariants)
    .innerJoin(s.products, eq(s.products.id, s.productVariants.productId))
    .where(inArray(s.productVariants.id, [...new Set(ids)]));
  return new Map(
    rows.map(({ v, p }) => [
      v.id,
      {
        id: v.id,
        name: `${p.nameEn} ${v.packSize}`,
        nameHi: `${p.nameHi} ${v.packSize}`,
        packSize: v.packSize,
        pricePaise: v.pricePaise,
        subscriptionPricePaise: v.subscriptionPricePaise ?? v.pricePaise,
        subscribable: v.subscribable && v.status === 'active' && p.status === 'active',
        status: v.status,
      },
    ]),
  );
}

/** Variants must exist, be subscribable and be sold in the address's zone. */
export async function assertSubscribable(db: DbOrTx, variantIds: string[], zoneId: string | null): Promise<Map<string, VariantInfo>> {
  const info = await variantInfo(db, variantIds);
  const zoneOk = zoneId
    ? new Set(
        (
          await db
            .select({ id: s.zoneAvailability.variantId })
            .from(s.zoneAvailability)
            .where(and(eq(s.zoneAvailability.zoneId, zoneId), eq(s.zoneAvailability.available, true), inArray(s.zoneAvailability.variantId, variantIds)))
        ).map((r) => r.id),
      )
    : new Set<string>();
  for (const id of variantIds) {
    const v = info.get(id);
    if (!v || !v.subscribable) throw new AppError('PRODUCT_UNAVAILABLE', 422, `Product ${id} cannot be subscribed to`);
    if (!zoneOk.has(id)) throw new AppError('PRODUCT_UNAVAILABLE', 422, `${v.name} is not available in your area`);
  }
  return info;
}

export function nextDelivery(spec: SubscriptionSpec, from: BusinessDate, holidays: ReadonlySet<BusinessDate>): BusinessDate | null {
  for (let i = 0; i < 60; i++) {
    const d = addDays(from, i);
    if (itemsForDate(spec, d, holidays).length > 0) return d;
  }
  return null;
}

export function subscriptionOut(
  sub: LoadedSubscription,
  info: Map<string, VariantInfo>,
  ctx: {
    language: 'en' | 'hi';
    firstOpen: BusinessDate;
    holidays: ReadonlySet<BusinessDate>;
    slot: { id: string; code: string; label: string };
    addressLabel: string | null;
    cutoffAt: (date: BusinessDate) => Date;
  },
) {
  const next = sub.row.status === 'active' ? nextDelivery(sub.spec, ctx.firstOpen, ctx.holidays) : null;
  const price = (id: string) => info.get(id)?.subscriptionPricePaise ?? 0;
  return {
    id: sub.row.id,
    status: sub.row.status,
    pattern: sub.row.pattern,
    startsOn: sub.row.startsOn,
    endsOn: sub.row.endsOn,
    effectiveFrom: ctx.firstOpen,
    address: { id: sub.row.addressId, label: ctx.addressLabel },
    slot: ctx.slot,
    items: sub.items.map((i) => ({
      variantId: i.variantId,
      name: (ctx.language === 'hi' ? info.get(i.variantId)?.nameHi : info.get(i.variantId)?.name) ?? i.variantId,
      ...(i.quantity !== null ? { quantity: i.quantity } : {}),
      ...(i.weekdayQuantities ? { weekdayQuantities: i.weekdayQuantities } : {}),
      unitPrice: { amount: price(i.variantId), currency: 'INR' as const },
    })),
    estimatedMonthly: { amount: sub.row.status === 'active' ? estimateMonthly(sub.spec, ctx.firstOpen, price) : 0, currency: 'INR' as const },
    pauses: sub.pauses
      .filter((p) => p.endsOn >= ctx.firstOpen)
      .sort((a, b) => (a.startsOn < b.startsOn ? -1 : 1))
      .map((p) => ({ id: p.id, startsOn: p.startsOn, endsOn: p.endsOn })),
    nextDelivery: next ? { date: next, cutoffAt: ctx.cutoffAt(next).toISOString() } : null,
  };
}
