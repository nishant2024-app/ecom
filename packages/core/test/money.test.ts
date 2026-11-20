import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { formatINR, lineTotal, paiseToRupeeString, percentOf, rupeesToPaise } from '../src/money';

describe('money', () => {
  it('converts to and from rupee strings exactly', () => {
    expect(paiseToRupeeString(64000)).toBe('640.00');
    expect(paiseToRupeeString(5)).toBe('0.05');
    expect(rupeesToPaise('640.5')).toBe(64050);
    expect(rupeesToPaise(19.99)).toBe(1999);
    fc.assert(fc.property(fc.integer({ min: -1e12, max: 1e12 }), (p) => rupeesToPaise(paiseToRupeeString(p)) === p));
  });
  it('rejects floats and bad input', () => {
    expect(() => lineTotal(10.5, 2)).toThrow();
    expect(() => rupeesToPaise('12.345')).toThrow();
  });
  it('rounds percentages half up', () => {
    expect(percentOf(1000, 500)).toBe(50);
    expect(percentOf(999, 500)).toBe(50); // 49.95 → 50
    expect(percentOf(989, 500)).toBe(49); // 49.45 → 49
  });
  it('formats with Indian grouping', () => {
    expect(formatINR(10000000)).toBe('₹1,00,000');
    expect(formatINR(6450)).toBe('₹64.50');
  });
});
