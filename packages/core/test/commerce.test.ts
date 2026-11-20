import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { canTransition, customerCanCancel, nextStatus, orderNumber, OrderStateError } from '../src/orders';
import { quoteShipping, stateForPincode, zoneForPincode, type ShippingZone } from '../src/shipping';

const zones: ShippingZone[] = [
  { code: 'local', name: 'Pune', pincodePrefixes: ['411', '412'], feePaise: 4000, freeAbovePaise: 49900, includedGrams: 2000, perExtraKgPaise: 2000, etaMinDays: 1, etaMaxDays: 2, serviceable: true },
  { code: 'state', name: 'Maharashtra', pincodePrefixes: ['40', '41', '42', '43', '44'], feePaise: 6000, freeAbovePaise: 69900, includedGrams: 2000, perExtraKgPaise: 2500, etaMinDays: 2, etaMaxDays: 4, serviceable: true },
  { code: 'national', name: 'Rest of India', pincodePrefixes: [''], feePaise: 9000, freeAbovePaise: 99900, includedGrams: 2000, perExtraKgPaise: 3000, etaMinDays: 3, etaMaxDays: 6, serviceable: true },
  { code: 'remote', name: 'North East, J&K, islands', pincodePrefixes: ['18', '19', '78', '79', '744'], feePaise: 15000, freeAbovePaise: null, includedGrams: 1000, perExtraKgPaise: 5000, etaMinDays: 6, etaMaxDays: 10, serviceable: true },
  { code: 'apo', name: 'Army post', pincodePrefixes: ['9'], feePaise: 0, freeAbovePaise: null, includedGrams: 0, perExtraKgPaise: 0, etaMinDays: 0, etaMaxDays: 0, serviceable: false },
];

describe('shipping zones', () => {
  it('uses the longest matching prefix', () => {
    expect(zoneForPincode('411045', zones)?.code).toBe('local');
    expect(zoneForPincode('400001', zones)?.code).toBe('state');
    expect(zoneForPincode('110001', zones)?.code).toBe('national');
    expect(zoneForPincode('781001', zones)?.code).toBe('remote');
    expect(zoneForPincode('744101', zones)?.code).toBe('remote');
  });
  it('quotes fees, free thresholds and weight surcharges', () => {
    expect(quoteShipping('411045', 30000, 1500, zones)).toMatchObject({ feePaise: 4000, free: false, remainingForFreePaise: 19900, etaMaxDays: 2 });
    expect(quoteShipping('411045', 49900, 1500, zones)).toMatchObject({ feePaise: 0, free: true });
    expect(quoteShipping('110001', 50000, 4200, zones).feePaise).toBe(9000 + 3 * 3000);
    expect(quoteShipping('781001', 500000, 500, zones)).toMatchObject({ free: false, remainingForFreePaise: 0 });
  });
  it('rejects invalid and unserviceable pincodes', () => {
    expect(() => quoteShipping('12345', 0, 0, zones)).toThrow(/6-digit/);
    expect(() => quoteShipping('900001', 0, 0, zones)).toThrow(/do not ship/);
  });
  it('property: free shipping never charges and fees never go negative', () => {
    fc.assert(
      fc.property(fc.integer({ min: 110000, max: 899999 }), fc.integer({ min: 0, max: 2_000_000 }), fc.integer({ min: 0, max: 20_000 }), (pin, subtotal, grams) => {
        const q = quoteShipping(String(pin), subtotal, grams, zones);
        return q.feePaise >= 0 && (!q.free || q.feePaise === 0);
      }),
    );
  });
  it('maps pincodes to states', () => {
    expect(stateForPincode('411045')).toBe('Maharashtra');
    expect(stateForPincode('560001')).toBe('Karnataka');
    expect(stateForPincode('403001')).toBe('Goa');
  });
});

describe('order state machine', () => {
  it('follows pay → pack → ship → deliver', () => {
    let s = nextStatus('pending_payment', 'pay');
    s = nextStatus(s, 'pack');
    s = nextStatus(s, 'ship');
    expect(nextStatus(s, 'deliver')).toBe('delivered');
  });
  it('refuses invalid transitions', () => {
    expect(() => nextStatus('shipped', 'cancel')).toThrow(OrderStateError);
    expect(() => nextStatus('pending_payment', 'ship')).toThrow(/Cannot ship/);
    expect(canTransition('confirmed', 'cancel')).toBe(true);
  });
  it('lets customers cancel only before packing', () => {
    expect(customerCanCancel('confirmed')).toBe(true);
    expect(customerCanCancel('packed')).toBe(false);
  });
  it('formats order numbers', () => {
    expect(orderNumber('2026-12-02', 42)).toBe('D-261202-0042');
  });
});
