import { assertPaise, sumPaise } from './money';
import { financialYearLabel, type BusinessDate } from './time';

/**
 * GST helpers. Prices are GST-inclusive (B2C). Rates are configured per HSN code in admin
 * (basis points: 500 = 5%) and must be confirmed with the business's accountant.
 */

export interface TaxSplit {
  taxable: number;
  tax: number;
}

/** Back-calculate taxable value and tax from a GST-inclusive line total. */
export function splitInclusive(lineTotalPaise: number, rateBps: number): TaxSplit {
  assertPaise(lineTotalPaise);
  if (!Number.isInteger(rateBps) || rateBps < 0 || rateBps > 2800) {
    throw new RangeError(`invalid GST rate ${rateBps} bps`);
  }
  if (rateBps === 0) return { taxable: lineTotalPaise, tax: 0 };
  const taxable = Math.round((lineTotalPaise * 10000) / (10000 + rateBps));
  return { taxable, tax: lineTotalPaise - taxable };
}

export interface TaxLineInput {
  lineTotalPaise: number;
  rateBps: number;
  hsnCode: string;
}

export interface InvoiceTotals {
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
  byRate: { rateBps: number; hsnCode: string; taxable: number; tax: number }[];
}

/** Totals for an invoice. Intra-state supply splits tax equally into CGST and SGST. */
export function invoiceTotals(lines: readonly TaxLineInput[], interState = false): InvoiceTotals {
  const groups = new Map<string, { rateBps: number; hsnCode: string; taxable: number; tax: number }>();
  for (const line of lines) {
    const { taxable, tax } = splitInclusive(line.lineTotalPaise, line.rateBps);
    const key = `${line.hsnCode}|${line.rateBps}`;
    const g = groups.get(key) ?? { rateBps: line.rateBps, hsnCode: line.hsnCode, taxable: 0, tax: 0 };
    g.taxable += taxable;
    g.tax += tax;
    groups.set(key, g);
  }
  const byRate = [...groups.values()];
  const tax = sumPaise(byRate.map((g) => g.tax));
  const cgst = interState ? 0 : Math.floor(tax / 2);
  const sgst = interState ? 0 : tax - cgst;
  return {
    taxable: sumPaise(byRate.map((g) => g.taxable)),
    cgst,
    sgst,
    igst: interState ? tax : 0,
    total: sumPaise(lines.map((l) => l.lineTotalPaise)),
    byRate,
  };
}

export type InvoiceKind = 'tax_invoice' | 'bill_of_supply' | 'invoice_cum_bos';

export function invoiceKind(rates: readonly number[]): InvoiceKind {
  const taxed = rates.some((r) => r > 0);
  const exempt = rates.some((r) => r === 0);
  if (taxed && exempt) return 'invoice_cum_bos';
  return taxed ? 'tax_invoice' : 'bill_of_supply';
}

/** Sequential invoice number per financial year, at most 16 characters: INV/26-27/000123 */
export function invoiceNumber(date: BusinessDate, sequence: number): string {
  if (!Number.isInteger(sequence) || sequence < 1 || sequence > 999_999) {
    throw new RangeError('invoice sequence out of range');
  }
  const n = `INV/${financialYearLabel(date)}/${String(sequence).padStart(6, '0')}`;
  if (n.length > 16) throw new Error('invoice number longer than 16 characters');
  return n;
}
