import { describe, expect, it } from 'vitest';
import { parseNetQuantity, unitPrice } from '../src/quantity';

describe('net quantity from pack labels', () => {
  it.each([
    ['500 ml', { amount: 500, unit: 'ml' }],
    ['1 L tin', { amount: 1000, unit: 'ml' }],
    ['1.5 L', { amount: 1500, unit: 'ml' }],
    ['6 × 180 ml', { amount: 1080, unit: 'ml' }],
    ['6 x 200ml', { amount: 1200, unit: 'ml' }],
    ['250 g box', { amount: 250, unit: 'g' }],
    ['1 kg', { amount: 1000, unit: 'g' }],
    ['400 g can', { amount: 400, unit: 'g' }],
  ])('%s', (label, expected) => expect(parseNetQuantity(label)).toEqual(expected));

  it('returns null when there is no quantity', () => {
    expect(parseNetQuantity('Gift box')).toBeNull();
    expect(parseNetQuantity('')).toBeNull();
  });

  it('prices per 100 ml / 100 g', () => {
    expect(unitPrice(115000, '500 ml')).toEqual({ paise: 23000, per: '100 ml' });
    expect(unitPrice(220000, '1 L')).toEqual({ paise: 22000, per: '100 ml' });
    expect(unitPrice(24000, '6 × 180 ml')).toEqual({ paise: 2222, per: '100 ml' });
    expect(unitPrice(22000, '250 g box')).toEqual({ paise: 8800, per: '100 g' });
    expect(unitPrice(1000, 'assorted')).toBeNull();
  });
});

import { directionsUrl, isInIndia } from '../src/geo';
describe('geo', () => {
  it('accepts points in India and rejects others', () => {
    expect(isInIndia(18.559, 73.7868)).toBe(true); // Pune
    expect(isInIndia(11.62, 92.72)).toBe(true); // Port Blair
    expect(isInIndia(0, 0)).toBe(false);
    expect(isInIndia(73.78, 18.55)).toBe(false); // swapped
    expect(isInIndia(51.5, -0.12)).toBe(false); // London
  });
  it('builds a directions link', () => {
    expect(directionsUrl(18.5590123456, 73.7868)).toBe('https://www.google.com/maps/dir/?api=1&destination=18.559012,73.7868');
  });
});
