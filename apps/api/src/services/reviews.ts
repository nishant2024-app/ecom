import { schema as s, type DbOrTx } from '@dairy/db';
import { and, eq, inArray, sql } from 'drizzle-orm';

export interface RatingSummary {
  average: number;
  count: number;
}

/** Average rating and count of approved reviews, per product. */
export async function ratings(db: DbOrTx, productIds: string[]): Promise<Map<string, RatingSummary>> {
  if (!productIds.length) return new Map();
  const rows = await db
    .select({ productId: s.productReviews.productId, avg: sql<string>`avg(${s.productReviews.rating})`, n: sql<number>`count(*)::int` })
    .from(s.productReviews)
    .where(and(inArray(s.productReviews.productId, productIds), eq(s.productReviews.status, 'approved')))
    .groupBy(s.productReviews.productId);
  return new Map(rows.map((r) => [r.productId, { average: Math.round(Number(r.avg) * 10) / 10, count: Number(r.n) }]));
}

/** The customer's most recent delivered order that contains this product, if any. */
export async function deliveredOrderFor(db: DbOrTx, customerId: string, productId: string): Promise<string | null> {
  const [row] = await db
    .select({ orderId: s.orders.id })
    .from(s.orders)
    .innerJoin(s.orderItems, eq(s.orderItems.orderId, s.orders.id))
    .innerJoin(s.productVariants, eq(s.productVariants.id, s.orderItems.variantId))
    .where(and(eq(s.orders.customerId, customerId), eq(s.orders.status, 'delivered'), eq(s.productVariants.productId, productId)))
    .orderBy(sql`${s.orders.createdAt} desc`)
    .limit(1);
  return row?.orderId ?? null;
}

/** "Asha V." from "Asha Verma": reviews show first name and initial only. */
export function publicName(full: string) {
  const [first = 'Customer', ...rest] = full.trim().split(/\s+/);
  const last = rest.at(-1);
  return last ? `${first} ${last[0]!.toUpperCase()}.` : first;
}
