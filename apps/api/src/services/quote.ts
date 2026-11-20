import { lineTotal, quoteShipping, ShippingError, splitInclusive, sumPaise, todayIST, type ShippingQuote } from '@dairy/core';
import { schema as s, type DbOrTx } from '@dairy/db';
import { inArray } from 'drizzle-orm';
import { eq } from 'drizzle-orm';
import { AppError } from '../lib/errors';
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
  weightGrams: number;
  taxPaise: number;
  shipping: ShippingQuote | null;
  shippingError: string | null;
  totalPaise: number;
  ok: boolean;
}

/** Price a cart from current catalog prices and stock. Never trusts client prices. */
export async function quoteCart(db: DbOrTx, input: CartLineInput[], pincode: string | undefined, now: Date): Promise<Quote> {
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
  const tax = sumPaise(lines.map((l) => splitInclusive(l.totalPaise, l.gstRateBps).tax));
  let shipping: ShippingQuote | null = null;
  let shippingError: string | null = null;
  if (pincode) {
    try {
      shipping = quoteShipping(pincode, subtotal, weight, await shippingZones(db));
    } catch (err) {
      if (err instanceof ShippingError) shippingError = err.message;
      else throw err;
    }
  }
  return {
    lines,
    subtotalPaise: subtotal,
    weightGrams: weight,
    taxPaise: tax,
    shipping,
    shippingError,
    totalPaise: subtotal + (shipping?.feePaise ?? 0),
    ok: lines.length > 0 && lines.every((l) => l.problem === null) && (!pincode || shipping !== null),
  };
}
