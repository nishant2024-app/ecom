import { describe, expect, it } from 'vitest';
import { planDeliveries, unitsByVariant, type PlanSubscription } from '../src/delivery-plan';

const sub = (id: string, customerId: string, qty: number): PlanSubscription => ({
  id,
  customerId,
  addressId: `adr-${customerId}`,
  pattern: 'daily',
  status: 'active',
  startsOn: '2026-12-01',
  endsOn: null,
  items: [{ variantId: 'milk', quantity: qty }],
});

describe('planDeliveries', () => {
  const base = {
    date: '2026-12-02',
    subscriptionPrice: () => 3000,
  };
  it('charges subscriptions and keeps prepaid orders', () => {
    const plans = planDeliveries({
      ...base,
      subscriptions: [sub('s1', 'c1', 2)],
      orderLines: [{ orderId: 'o1', customerId: 'c1', addressId: 'adr-c1', variantId: 'paneer', quantity: 1, unitPricePaise: 9000 }],
      wallet: () => ({ balancePaise: 10000, overdraftLimitPaise: 0 }),
    });
    expect(plans).toHaveLength(1);
    expect(plans[0]).toMatchObject({ chargePaise: 6000, status: 'scheduled' });
    expect(plans[0]!.items).toHaveLength(2);
  });
  it('skips subscription items when the balance is too low, but still delivers orders', () => {
    const plans = planDeliveries({
      ...base,
      subscriptions: [sub('s1', 'c1', 2), sub('s2', 'c2', 1)],
      orderLines: [{ orderId: 'o1', customerId: 'c1', addressId: 'adr-c1', variantId: 'paneer', quantity: 1, unitPricePaise: 9000 }],
      wallet: (c) => ({ balancePaise: c === 'c1' ? 1000 : 0, overdraftLimitPaise: 0 }),
    });
    const c1 = plans.find((p) => p.customerId === 'c1')!;
    const c2 = plans.find((p) => p.customerId === 'c2')!;
    expect(c1).toMatchObject({ chargePaise: 0, status: 'scheduled' });
    expect(c1.skippedItems).toHaveLength(1);
    expect(c2).toMatchObject({ status: 'skipped_low_balance', items: [] });
    expect(unitsByVariant(plans).get('paneer')).toBe(1);
    expect(unitsByVariant(plans).get('milk')).toBeUndefined();
  });
});
