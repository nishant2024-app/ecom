import { canCharge } from './ledger';
import { lineTotal, sumPaise } from './money';
import { itemsForDate, type SubscriptionSpec } from './subscription';
import type { BusinessDate } from './time';

/**
 * Pure planning step of the cutoff job: which deliveries to create for a date and slot,
 * and what to charge each wallet. The database layer persists the plan idempotently.
 */

export interface PlanSubscription extends SubscriptionSpec {
  id: string;
  customerId: string;
  addressId: string;
}

export interface PlanOrderLine {
  orderId: string;
  customerId: string;
  addressId: string;
  variantId: string;
  quantity: number;
  unitPricePaise: number;
}

export interface PlannedItem {
  variantId: string;
  quantity: number;
  unitPricePaise: number;
  source: 'subscription' | 'order';
  subscriptionId?: string;
  orderId?: string;
}

export interface PlannedDelivery {
  customerId: string;
  addressId: string;
  items: PlannedItem[];
  /** Amount to debit from the wallet now (subscription items only; orders are prepaid). */
  chargePaise: number;
  status: 'scheduled' | 'skipped_low_balance';
  skippedItems: PlannedItem[];
}

export interface PlanInput {
  date: BusinessDate;
  subscriptions: readonly PlanSubscription[];
  orderLines: readonly PlanOrderLine[];
  holidays?: ReadonlySet<BusinessDate>;
  /** Subscription price per variant, in paise. */
  subscriptionPrice: (variantId: string) => number;
  wallet: (customerId: string) => { balancePaise: number; overdraftLimitPaise: number };
}

export function planDeliveries(input: PlanInput): PlannedDelivery[] {
  const byKey = new Map<string, { customerId: string; addressId: string; sub: PlannedItem[]; ord: PlannedItem[] }>();
  const bucket = (customerId: string, addressId: string) => {
    const key = `${customerId}|${addressId}`;
    let b = byKey.get(key);
    if (!b) {
      b = { customerId, addressId, sub: [], ord: [] };
      byKey.set(key, b);
    }
    return b;
  };

  for (const s of input.subscriptions) {
    for (const item of itemsForDate(s, input.date, input.holidays)) {
      bucket(s.customerId, s.addressId).sub.push({
        variantId: item.variantId,
        quantity: item.quantity,
        unitPricePaise: input.subscriptionPrice(item.variantId),
        source: 'subscription',
        subscriptionId: s.id,
      });
    }
  }
  for (const o of input.orderLines) {
    bucket(o.customerId, o.addressId).ord.push({
      variantId: o.variantId,
      quantity: o.quantity,
      unitPricePaise: o.unitPricePaise,
      source: 'order',
      orderId: o.orderId,
    });
  }

  // Charge per customer across all their addresses, in a stable order.
  const remaining = new Map<string, number>();
  const plans: PlannedDelivery[] = [];
  for (const b of [...byKey.values()].sort((a, c) => (a.customerId + a.addressId < c.customerId + c.addressId ? -1 : 1))) {
    const w = input.wallet(b.customerId);
    const balance = remaining.get(b.customerId) ?? w.balancePaise;
    const charge = sumPaise(b.sub.map((i) => lineTotal(i.unitPricePaise, i.quantity)));
    const affordable = charge === 0 || canCharge(balance, charge, w.overdraftLimitPaise);
    const items = affordable ? [...b.sub, ...b.ord] : [...b.ord];
    if (affordable) remaining.set(b.customerId, balance - charge);
    plans.push({
      customerId: b.customerId,
      addressId: b.addressId,
      items,
      chargePaise: affordable ? charge : 0,
      status: items.length > 0 ? 'scheduled' : 'skipped_low_balance',
      skippedItems: affordable ? [] : b.sub,
    });
  }
  return plans;
}

/** Units per variant across planned deliveries (input to the production plan). */
export function unitsByVariant(plans: readonly PlannedDelivery[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const p of plans) for (const i of p.items) totals.set(i.variantId, (totals.get(i.variantId) ?? 0) + i.quantity);
  return totals;
}
