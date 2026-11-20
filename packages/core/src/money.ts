/**
 * Money is always integer paise (1/100 rupee). Never use floats for amounts.
 * The API exposes money as `{ amount, currency }`; internally we pass plain paise numbers.
 */

export type Currency = 'INR';

export interface Money {
  amount: number;
  currency: Currency;
}

export class MoneyError extends Error {}

export function assertPaise(value: number, label = 'amount'): number {
  if (!Number.isSafeInteger(value)) {
    throw new MoneyError(`${label} must be an integer number of paise, got ${value}`);
  }
  return value;
}

export function inr(paise: number): Money {
  return { amount: assertPaise(paise), currency: 'INR' };
}

export function sumPaise(values: readonly number[]): number {
  let total = 0;
  for (const v of values) total += assertPaise(v);
  return assertPaise(total, 'sum');
}

/** Multiply a unit price by a quantity, both integers. */
export function lineTotal(unitPaise: number, quantity: number): number {
  assertPaise(unitPaise, 'unit price');
  if (!Number.isSafeInteger(quantity) || quantity < 0) {
    throw new MoneyError(`quantity must be a non-negative integer, got ${quantity}`);
  }
  return assertPaise(unitPaise * quantity, 'line total');
}

/**
 * Percentage of an amount in basis points (500 = 5%), rounded half-up to whole paise.
 * Integer arithmetic only.
 */
export function percentOf(paise: number, bps: number): number {
  assertPaise(paise);
  assertPaise(bps, 'bps');
  const sign = paise < 0 ? -1 : 1;
  const abs = Math.abs(paise);
  return sign * Math.floor((abs * bps + 5000) / 10000);
}

/** Paise → rupee decimal string with 2 places, as Cashfree expects ("640.00"). */
export function paiseToRupeeString(paise: number): string {
  assertPaise(paise);
  const sign = paise < 0 ? '-' : '';
  const abs = Math.abs(paise);
  const rupees = Math.floor(abs / 100);
  const rest = String(abs % 100).padStart(2, '0');
  return `${sign}${rupees}.${rest}`;
}

/** Rupee decimal (string or number from a gateway) → paise, without float rounding errors. */
export function rupeesToPaise(value: string | number): number {
  const str = typeof value === 'number' ? value.toFixed(2) : value.trim();
  const match = /^(-)?(\d+)(?:\.(\d{1,2}))?$/.exec(str);
  if (!match) throw new MoneyError(`not a rupee amount: ${value}`);
  const [, neg, whole, frac = ''] = match;
  const paise = Number(whole) * 100 + Number(frac.padEnd(2, '0'));
  return assertPaise(neg ? -paise : paise);
}

const formatters = new Map<string, Intl.NumberFormat>();

/** Display format with Indian digit grouping: ₹1,00,000.00 */
export function formatINR(paise: number, opts: { showPaise?: boolean } = {}): string {
  const showPaise = opts.showPaise ?? paise % 100 !== 0;
  const key = showPaise ? 'p' : 'r';
  let f = formatters.get(key);
  if (!f) {
    f = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: showPaise ? 2 : 0,
      maximumFractionDigits: showPaise ? 2 : 0,
    });
    formatters.set(key, f);
  }
  return f.format(paise / 100);
}
