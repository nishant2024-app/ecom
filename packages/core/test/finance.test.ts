import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { invoiceKind, invoiceNumber, invoiceTotals, splitInclusive } from '../src/gst';
import { allocateFefo, productionNeed } from '../src/fefo';

describe('GST', () => {
  it('back-calculates tax from inclusive prices', () => {
    expect(splitInclusive(10500, 500)).toEqual({ taxable: 10000, tax: 500 });
    expect(splitInclusive(6400, 0)).toEqual({ taxable: 6400, tax: 0 });
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 1e9 }), fc.constantFrom(0, 500, 1200, 1800), (t, r) => {
        const s = splitInclusive(t, r);
        return s.taxable + s.tax === t && s.tax >= 0;
      }),
    );
  });
  it('splits CGST and SGST and groups by HSN', () => {
    const t = invoiceTotals([
      { lineTotalPaise: 6000, rateBps: 0, hsnCode: '0401' },
      { lineTotalPaise: 10501, rateBps: 500, hsnCode: '0403' },
    ]);
    expect(t.total).toBe(16501);
    expect(t.cgst + t.sgst).toBe(500);
    expect(t.byRate).toHaveLength(2);
  });
  it('picks the document type', () => {
    expect(invoiceKind([0, 0])).toBe('bill_of_supply');
    expect(invoiceKind([500])).toBe('tax_invoice');
    expect(invoiceKind([0, 500])).toBe('invoice_cum_bos');
  });
  it('numbers invoices within 16 characters', () => {
    expect(invoiceNumber('2026-12-02', 123)).toBe('INV/26-27/000123');
  });
});

describe('FEFO', () => {
  const batches = [
    { id: 'b3', expiresOn: '2026-12-06', available: 100 },
    { id: 'b1', expiresOn: '2026-12-04', available: 30 },
    { id: 'b0', expiresOn: '2026-12-02', available: 500 }, // too close to expiry
  ];
  it('allocates earliest expiry first and reports shortfall', () => {
    expect(allocateFefo(batches, 50, '2026-12-02')).toEqual({
      allocations: [
        { batchId: 'b1', quantity: 30 },
        { batchId: 'b3', quantity: 20 },
      ],
      shortfall: 0,
    });
    expect(allocateFefo(batches, 200, '2026-12-02').shortfall).toBe(70);
  });
  it('computes production need with buffer', () => {
    expect(productionNeed(2000, 300)).toEqual({ required: 2000, buffer: 100, inStock: 300, toProduce: 1800 });
  });
});
