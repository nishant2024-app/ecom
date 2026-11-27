import { allocateDiscount, lineTotal, quoteShipping, ShippingError, splitInclusive, sumPaise, todayIST, type ShippingQuote } from '@dairy/core';
import { schema as s, type DbOrTx } from '@dairy/db';
import { inArray } from 'drizzle-orm';
import { eq } from 'drizzle-orm';
import { AppError } from '../lib/errors';
import { describeCoupon, evaluateCoupon } from './coupons';
import { availability } from './stock';
import { shippingZones } from './store';

export interface CartLineInput {
  variantId: string;
  quantity: number;
}

export interface QuotedLine {
  variantId: string;
  productId: string;
  sellerId: string;
  slug: string;
  name: string;
  nameHi: string;
  sku: string;
  packSize: string;
  pack: s.PackVisual;
  unitPricePaise: number;
  mrpPaise: number;
  quantity: number;
  totalPaise: number;
  weightGrams: number;
  gstRateBps: number;
  hsnCode: string;
  available: number;
  maxPerOrder: number;
  problem: null | 'unavailable' | 'out_of_stock' | 'not_enough_stock' | 'over_limit';
}

export interface Quote {
  lines: QuotedLine[];
  subtotalPaise: number;
  /** Discount from the coupon (0 if none or not valid). Applies to products, not shipping. */
  discountPaise: number;
  coupon: { code: string; description: string } | null;
  /** Why the typed code did not apply (shown to the customer); null when fine or no code. */
  couponError: string | null;
  /** Internal: the coupon row to record a redemption against. */
  couponId: string | null;
  weightGrams: number;
  taxPaise: number;
  shipping: ShippingQuote | null;
  shippingError: string | null;
  totalPaise: number;
  ok: boolean;
}

/** Price a cart from current catalog prices and stock. Never trusts client prices. */
export async function quoteCart(db: DbOrTx, input: CartLineInput[], pincode: string | undefined, now: Date, opts: { couponCode?: string | null; customerId?: string | null } = {}): Promise<Quote> {
  const merged = new Map<string, number>();
  for (const l of input) merged.set(l.variantId, (merged.get(l.variantId) ?? 0) + l.quantity);
  const ids = [...merged.keys()];
  const rows = ids.length
    ? await db
        .select({ v: s.productVariants, p: s.products })
        .from(s.productVariants)
        .innerJoin(s.products, eq(s.products.id, s.productVariants.productId))
        .where(inArray(s.productVariants.id, ids))
    : [];
  const stock = await availability(db, ids, todayIST(now));

  const lines: QuotedLine[] = [];
  for (const [variantId, quantity] of merged) {
    const row = rows.find((r) => r.v.id === variantId);
    if (!row) throw new AppError('PRODUCT_UNAVAILABLE', 422, `Unknown product ${variantId}`);
    const { v, p } = row;
    const available = stock.get(v.id) ?? 0;
    const sellable = v.status === 'active' && p.status === 'active';
    const problem = !sellable ? 'unavailable' : available === 0 ? 'out_of_stock' : quantity > v.maxPerOrder ? 'over_limit' : quantity > available ? 'not_enough_stock' : null;
    lines.push({
      variantId: v.id,
      productId: p.id,
      sellerId: v.sellerId,
      slug: p.slug,
      name: p.nameEn,
      nameHi: p.nameHi,
      sku: v.sku,
      packSize: v.packSize,
      pack: p.pack,
      unitPricePaise: v.pricePaise,
      mrpPaise: v.mrpPaise,
      quantity,
      totalPaise: lineTotal(v.pricePaise, quantity),
      weightGrams: v.weightGrams * quantity,
      gstRateBps: v.gstRateBps,
      hsnCode: v.hsnCode,
      available,
      maxPerOrder: v.maxPerOrder,
      problem,
    });
  }

  const subtotal = sumPaise(lines.map((l) => l.totalPaise));
  const weight = lines.reduce((g, l) => g + l.weightGrams, 0);
  let discount = 0;
  let coupon: Quote['coupon'] = null;
  let couponError: string | null = null;
  let couponId: string | null = null;
  if (opts.couponCode?.trim()) {
    const check = await evaluateCoupon(db, opts.couponCode, { subtotalPaise: subtotal, customerId: opts.customerId ?? null, now });
    if (check.ok) {
      discount = check.discountPaise;
      coupon = { code: check.coupon.code, description: describeCoupon(check.coupon) };
      couponId = check.coupon.id;
    } else couponError = check.message;
  }
  // GST is included in prices, so a discount lowers the taxable value of each line in proportion.
  const shares = allocateDiscount(lines.map((l) => l.totalPaise), discount);
  const tax = sumPaise(lines.map((l, i) => splitInclusive(l.totalPaise - shares[i]!, l.gstRateBps).tax));
  const payable = subtotal - discount; // free-shipping thresholds look at what the customer actually pays for products
  let shipping: ShippingQuote | null = null;
  let shippingError: string | null = null;
  if (pincode) {
    try {
      shipping = quoteShipping(pincode, payable, weight, await shippingZones(db));
    } catch (err) {
      if (err instanceof ShippingError) shippingError = err.message;
      else throw err;
    }
  }
  return {
    lines,
    subtotalPaise: subtotal,
    discountPaise: discount,
    coupon,
    couponError,
    couponId,
    weightGrams: weight,
    taxPaise: tax,
    shipping,
    shippingError,
    totalPaise: payable + (shipping?.feePaise ?? 0),
    ok: lines.length > 0 && lines.every((l) => l.problem === null) && (!pincode || shipping !== null),
  };
}
