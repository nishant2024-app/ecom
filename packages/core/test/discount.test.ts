import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { allocateDiscount, isCouponCode, normalizeCouponCode } from '../src/discount';

describe('allocateDiscount', () => {
  it('splits in proportion and adds up exactly', () => {
    expect(allocateDiscount([60000, 40000], 10000)).toEqual([6000, 4000]);
    expect(allocateDiscount([100, 100, 100], 100)).toEqual([34, 33, 33]);
  });
  it('never exceeds a line and caps at the order total', () => {
    expect(allocateDiscount([500, 300], 5000)).toEqual([500, 300]);
    expect(allocateDiscount([500], 0)).toEqual([0]);
    expect(allocateDiscount([], 100)).toEqual([]);
  });
  it('is exact for any cart (property)', () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 100, max: 500_000 }), { minLength: 1, maxLength: 12 }), fc.integer({ min: 0, max: 3_000_000 }), (lines, d) => {
        const parts = allocateDiscount(lines, d);
        const total = lines.reduce((a, b) => a + b, 0);
        expect(parts.reduce((a, b) => a + b, 0)).toBe(Math.min(d, total));
        parts.forEach((p, i) => {
          expect(p).toBeGreaterThanOrEqual(0);
          expect(p).toBeLessThanOrEqual(lines[i]!);
        });
      }),
    );
  });
});

describe('coupon codes', () => {
  it('normalises what customers type', () => {
    expect(normalizeCouponCode(' diwali 10 ')).toBe('DIWALI10');
    expect(isCouponCode('DIWALI10')).toBe(true);
    expect(isCouponCode('A')).toBe(false);
    expect(isCouponCode('BAD CODE!')).toBe(false);
  });
});
