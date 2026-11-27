import { isCouponCode, normalizeCouponCode, percentOf } from '@dairy/core';
import { schema as s, type DbOrTx } from '@dairy/db';
import { and, count, eq, inArray, ne } from 'drizzle-orm';
import { defaultSellerId } from './store';

export type Coupon = typeof s.coupons.$inferSelect;
export type CouponCheck = { ok: true; coupon: Coupon; discountPaise: number } | { ok: false; message: string };

const rupees = (p: number) => `₹${(p / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const BAD = 'This code is not valid.';

/**
 * Decide whether a code works for this cart and how much it takes off. The discount applies to the products
 * (not shipping) and never exceeds the products' total. Used for the live quote and again, under a lock, when the
 * order is placed. Orders that were cancelled or expired do not count as uses.
 */
export async function evaluateCoupon(db: DbOrTx, rawCode: string, ctx: { subtotalPaise: number; customerId: string | null; now: Date }): Promise<CouponCheck> {
  const code = normalizeCouponCode(rawCode);
  if (!isCouponCode(code)) return { ok: false, message: BAD };
  const sellerId = await defaultSellerId(db);
  const [coupon] = await db.select().from(s.coupons).where(and(eq(s.coupons.sellerId, sellerId), eq(s.coupons.code, code)));
  if (!coupon || coupon.status !== 'active') return { ok: false, message: BAD };
  if (coupon.startsAt && ctx.now < coupon.startsAt) return { ok: false, message: 'This code is not active yet.' };
  if (coupon.endsAt && ctx.now > coupon.endsAt) return { ok: false, message: 'This code has expired.' };
  if (ctx.subtotalPaise < coupon.minSubtotalPaise) return { ok: false, message: `Add ${rupees(coupon.minSubtotalPaise - ctx.subtotalPaise)} more to use this code (minimum ${rupees(coupon.minSubtotalPaise)}).` };

  const live = ne(s.orders.status, 'cancelled');
  if (coupon.usageLimit !== null) {
    const [row] = await db.select({ n: count() }).from(s.couponRedemptions).innerJoin(s.orders, eq(s.orders.id, s.couponRedemptions.orderId)).where(and(eq(s.couponRedemptions.couponId, coupon.id), live));
    if (Number(row?.n ?? 0) >= coupon.usageLimit) return { ok: false, message: 'This code has been fully used.' };
  }
  if (ctx.customerId) {
    const [mineRow] = await db
      .select({ n: count() })
      .from(s.couponRedemptions)
      .innerJoin(s.orders, eq(s.orders.id, s.couponRedemptions.orderId))
      .where(and(eq(s.couponRedemptions.couponId, coupon.id), eq(s.couponRedemptions.customerId, ctx.customerId), live));
    if (Number(mineRow?.n ?? 0) >= coupon.perCustomerLimit) return { ok: false, message: coupon.perCustomerLimit === 1 ? 'You have already used this code.' : 'You have used this code the maximum number of times.' };
    if (coupon.firstOrderOnly) {
      const [priorRow] = await db
        .select({ n: count() })
        .from(s.orders)
        .where(and(eq(s.orders.customerId, ctx.customerId), inArray(s.orders.status, ['confirmed', 'packed', 'shipped', 'delivered'])));
      if (Number(priorRow?.n ?? 0) > 0) return { ok: false, message: 'This code is for first orders only.' };
    }
  }

  let discount = coupon.kind === 'percent' ? percentOf(ctx.subtotalPaise, coupon.percentBps ?? 0) : (coupon.amountPaise ?? 0);
  if (coupon.kind === 'percent' && coupon.maxDiscountPaise) discount = Math.min(discount, coupon.maxDiscountPaise);
  discount = Math.min(discount, ctx.subtotalPaise);
  if (discount <= 0) return { ok: false, message: BAD };
  return { ok: true, coupon, discountPaise: discount };
}

/** Short customer-facing description, e.g. "10% off, up to ₹200". */
export function describeCoupon(c: Coupon): string {
  const base = c.kind === 'percent' ? `${(c.percentBps ?? 0) / 100}% off${c.maxDiscountPaise ? `, up to ${rupees(c.maxDiscountPaise)}` : ''}` : `${rupees(c.amountPaise ?? 0)} off`;
  return c.minSubtotalPaise ? `${base} on orders above ${rupees(c.minSubtotalPaise)}` : base;
}
