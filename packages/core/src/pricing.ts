import { lineTotal, percentOf, sumPaise } from './money';

export interface PriceLineInput {
  variantId: string;
  quantity: number;
  unitPricePaise: number;
  /** Refundable bottle deposit per unit, charged once per new bottle. Not discountable. */
  depositPaise?: number;
  categoryId?: string;
}

export type CouponRule =
  | { kind: 'percent'; bps: number; maxDiscountPaise?: number }
  | { kind: 'fixed'; amountPaise: number };

export interface CouponInput {
  code: string;
  rule: CouponRule;
  minSubtotalPaise?: number;
  categoryIds?: readonly string[];
}

export interface PricedLine extends PriceLineInput {
  totalPaise: number;
}

export interface PriceResult {
  lines: PricedLine[];
  subtotal: number;
  discount: number;
  deposit: number;
  total: number;
  couponError?: string;
}

/** Price a set of lines with an optional coupon. Coupons never go below zero and never touch deposits. */
export function priceLines(lines: readonly PriceLineInput[], coupon?: CouponInput): PriceResult {
  const priced = lines.map((l) => ({ ...l, totalPaise: lineTotal(l.unitPricePaise, l.quantity) }));
  const subtotal = sumPaise(priced.map((l) => l.totalPaise));
  const deposit = sumPaise(priced.map((l) => lineTotal(l.depositPaise ?? 0, l.quantity)));

  let discount = 0;
  let couponError: string | undefined;
  if (coupon) {
    const eligible = coupon.categoryIds?.length
      ? sumPaise(priced.filter((l) => l.categoryId && coupon.categoryIds!.includes(l.categoryId)).map((l) => l.totalPaise))
      : subtotal;
    if (coupon.minSubtotalPaise !== undefined && subtotal < coupon.minSubtotalPaise) {
      couponError = 'Order is below the minimum for this coupon';
    } else if (eligible === 0) {
      couponError = 'No items in this order qualify for this coupon';
    } else if (coupon.rule.kind === 'percent') {
      discount = percentOf(eligible, coupon.rule.bps);
      if (coupon.rule.maxDiscountPaise !== undefined) discount = Math.min(discount, coupon.rule.maxDiscountPaise);
    } else {
      discount = Math.min(coupon.rule.amountPaise, eligible);
    }
  }

  return { lines: priced, subtotal, discount, deposit, total: subtotal - discount + deposit, couponError };
}
