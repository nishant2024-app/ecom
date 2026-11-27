import { directionsUrl } from '@dairy/core';
import { addMinutes } from './time-utils';
import { newId, nextStatus, orderNumber, OrderStateError, todayIST, type OrderAction, type OrderStatus } from '@dairy/core';
import { schema as s, type Db, type DbOrTx } from '@dairy/db';
import { and, asc, desc, eq, inArray, lt, sql } from 'drizzle-orm';
import type { AppDeps } from '../context';
import { AppError, notFound } from '../lib/errors';
import { quoteCart, type CartLineInput } from './quote';
import { release, reserve, ship } from './stock';
import { defaultSellerId, settingNumber, settingsMap } from './store';

export type Actor = { type: 'customer' | 'staff' | 'system'; id?: string | null };

async function nextOrderNumber(tx: DbOrTx, date: string): Promise<string> {
  const [row] = await tx
    .insert(s.counters)
    .values({ key: `orders:${date}`, value: 1 })
    .onConflictDoUpdate({ target: s.counters.key, set: { value: sql`${s.counters.value} + 1` } })
    .returning({ value: s.counters.value });
  return orderNumber(date, row!.value);
}

/** Apply a state-machine action, stamp the matching timestamp and record an event. */
export async function transition(tx: DbOrTx, orderId: string, action: OrderAction, actor: Actor, data: Record<string, unknown> = {}, extra: Partial<typeof s.orders.$inferInsert> = {}) {
  const [order] = await tx.select().from(s.orders).where(eq(s.orders.id, orderId)).for('update');
  if (!order) throw notFound('Order');
  let to: OrderStatus;
  try {
    to = nextStatus(order.status as OrderStatus, action);
  } catch (err) {
    if (err instanceof OrderStateError) throw new AppError('CONFLICT', 409, err.message);
    throw err;
  }
  const now = new Date();
  const stamps: Partial<typeof s.orders.$inferInsert> = {
    pay: { paidAt: now },
    pack: { packedAt: now },
    ship: { shippedAt: now },
    deliver: { deliveredAt: now },
    cancel: { cancelledAt: now },
    expire: { cancelledAt: now, cancelReason: 'Payment not completed in time' },
    refund: {},
  }[action];
  await tx.update(s.orders).set({ status: to, ...stamps, ...extra }).where(eq(s.orders.id, orderId));
  await tx.insert(s.orderEvents).values({ id: newId('oev'), orderId, type: action, fromStatus: order.status, toStatus: to, actorType: actor.type, actorId: actor.id ?? null, data });
  return { from: order.status as OrderStatus, to, order };
}

export interface PlaceOrderInput {
  customerId: string;
  addressId: string;
  lines: CartLineInput[];
  note?: string;
}

export async function placeOrder(deps: AppDeps, input: PlaceOrderInput) {
  const { db } = deps.db;
  const now = deps.now();
  const today = todayIST(now);
  const [customer] = await db.select().from(s.customers).where(eq(s.customers.id, input.customerId));
  if (!customer) throw notFound('Customer');
  const [address] = await db.select().from(s.addresses).where(and(eq(s.addresses.id, input.addressId), eq(s.addresses.customerId, input.customerId)));
  if (!address || address.archivedAt) throw new AppError('VALIDATION_FAILED', 400, 'Choose a delivery address');

  const quote = await quoteCart(db, input.lines, address.pincode, now);
  if (quote.shippingError || !quote.shipping) throw new AppError('NOT_SERVICEABLE', 422, quote.shippingError ?? 'We do not ship to this pincode yet');
  const problem = quote.lines.find((l) => l.problem);
  if (problem) {
    const detail = {
      unavailable: `${problem.name} is no longer sold`,
      out_of_stock: `${problem.name} is out of stock`,
      not_enough_stock: `Only ${problem.available} of ${problem.name} ${problem.packSize} left`,
      over_limit: `You can order up to ${problem.maxPerOrder} of ${problem.name} ${problem.packSize}`,
    }[problem.problem!];
    throw new AppError(problem.problem === 'unavailable' ? 'PRODUCT_UNAVAILABLE' : 'OUT_OF_STOCK', 422, detail);
  }

  const sellerId = await defaultSellerId(db);
  const windowMinutes = settingNumber(await settingsMap(db, sellerId), 'orders.paymentWindowMinutes', 30);
  const orderId = newId('ord');
  const paymentId = newId('pay');
  const expiresAt = addMinutes(now, windowMinutes);
  const shippingAddress: s.AddressSnapshot = {
    name: address.name,
    phone: address.phone,
    line1: address.line1,
    line2: address.line2,
    landmark: address.landmark,
    city: address.city,
    state: address.state,
    pincode: address.pincode,
    location:
      address.latitude != null && address.longitude != null
        ? { lat: address.latitude, lng: address.longitude, accuracyM: address.locationAccuracyM, source: (address.locationSource as 'device' | 'map_pin' | null) ?? 'map_pin' }
        : null,
  };

  await db.transaction(async (tx) => {
    const number = await nextOrderNumber(tx, today);
    await tx.insert(s.orders).values({
      id: orderId,
      number,
      customerId: customer.id,
      status: 'pending_payment',
      subtotalPaise: quote.subtotalPaise,
      shippingPaise: quote.shipping!.feePaise,
      taxPaise: quote.taxPaise,
      totalPaise: quote.totalPaise,
      shippingAddress,
      shippingZone: quote.shipping!.zoneCode,
      etaMinDays: quote.shipping!.etaMinDays,
      etaMaxDays: quote.shipping!.etaMaxDays,
      note: input.note ?? null,
      expiresAt,
      placedOn: today,
    });
    const items = quote.lines.map((l) => ({ ...l, orderItemId: newId('ori') }));
    await tx.insert(s.orderItems).values(
      items.map((l) => ({
        id: l.orderItemId,
        orderId,
        variantId: l.variantId,
        sellerId: l.sellerId,
        nameSnapshot: l.name,
        skuSnapshot: l.sku,
        packSize: l.packSize,
        unitPricePaise: l.unitPricePaise,
        quantity: l.quantity,
        weightGrams: l.weightGrams,
        gstRateBps: l.gstRateBps,
        hsnCode: l.hsnCode,
        lineTotalPaise: l.totalPaise,
      })),
    );
    const bySeller = new Map<string, number>();
    for (const l of items) bySeller.set(l.sellerId, (bySeller.get(l.sellerId) ?? 0) + l.totalPaise);
    for (const [sid, subtotal] of bySeller) await tx.insert(s.sellerOrders).values({ id: newId('ord'), orderId, sellerId: sid, subtotalPaise: subtotal });
    await reserve(tx, items.map((l) => ({ orderItemId: l.orderItemId, variantId: l.variantId, quantity: l.quantity, name: `${l.name} ${l.packSize}` })), today, orderId);
    await tx.insert(s.payments).values({
      id: paymentId,
      orderId,
      customerId: customer.id,
      amountPaise: quote.totalPaise,
      provider: deps.payments.name,
      providerOrderId: paymentId,
    });
    await tx.insert(s.orderEvents).values({ id: newId('oev'), orderId, type: 'placed', toStatus: 'pending_payment', actorType: 'customer', actorId: customer.id, data: { paymentId } });
  });

  await startPayment(deps, orderId, paymentId, { customer, phone: address.phone, expiresAt });
  return { orderId, paymentId };
}

/** Create the provider order for a payment row; on failure cancel the order and release stock. */
async function startPayment(deps: AppDeps, orderId: string, paymentId: string, ctx: { customer: typeof s.customers.$inferSelect; phone: string; expiresAt: Date }) {
  const { db } = deps.db;
  const [payment] = await db.select().from(s.payments).where(eq(s.payments.id, paymentId));
  try {
    const created = await deps.payments.createOrder({
      paymentId,
      amountPaise: payment!.amountPaise,
      customer: { id: ctx.customer.id, name: ctx.customer.name, email: ctx.customer.email, phone: ctx.phone },
      returnUrl: `${deps.config.PUBLIC_WEB_URL}/orders/${orderId}?payment=${paymentId}`,
      notifyUrl: `${deps.config.PUBLIC_API_URL}/v1/webhooks/cashfree/payments`,
      expiresAt: ctx.expiresAt,
    });
    await db.update(s.payments).set({ providerOrderId: created.providerOrderId, paymentSessionId: created.paymentSessionId }).where(eq(s.payments.id, paymentId));
  } catch (err) {
    await db.transaction(async (tx) => {
      await tx.update(s.payments).set({ status: 'failed', raw: { error: String(err) } }).where(eq(s.payments.id, paymentId));
      const [order] = await tx.select({ status: s.orders.status }).from(s.orders).where(eq(s.orders.id, orderId));
      if (order?.status === 'pending_payment') {
        await transition(tx, orderId, 'cancel', { type: 'system' }, { reason: 'payment_start_failed' }, { cancelReason: 'Payment could not be started' });
        await release(tx, orderId);
      }
    });
    throw new AppError('SERVICE_UNAVAILABLE', 503, 'Payments are temporarily unavailable. Your order was not placed; please try again.');
  }
}

/** Start a fresh payment attempt for an unpaid order (e.g. the customer closed the payment page). */
export async function retryPayment(deps: AppDeps, orderId: string, customerId: string) {
  const { db } = deps.db;
  const [order] = await db.select().from(s.orders).where(and(eq(s.orders.id, orderId), eq(s.orders.customerId, customerId)));
  if (!order) throw notFound('Order');
  if (order.status !== 'pending_payment') throw new AppError('CONFLICT', 409, 'This order no longer needs payment');
  const now = deps.now();
  if (order.expiresAt && order.expiresAt < now) throw new AppError('CONFLICT', 409, 'The payment window has closed; please place the order again');
  const [customer] = await db.select().from(s.customers).where(eq(s.customers.id, customerId));
  const paymentId = newId('pay');
  await db.insert(s.payments).values({ id: paymentId, orderId, customerId, amountPaise: order.totalPaise, provider: deps.payments.name, providerOrderId: paymentId });
  await startPayment(deps, orderId, paymentId, { customer: customer!, phone: order.shippingAddress.phone, expiresAt: order.expiresAt ?? addMinutes(now, 30) });
  return paymentId;
}

/**
 * A payment succeeded (verified webhook, provider status check or mock simulation).
 * Idempotent. If the order was already cancelled (e.g. expired), the money is refunded.
 */
export async function markPaid(deps: AppDeps, paymentId: string, info: { providerPaymentId?: string; method?: string; raw?: unknown }) {
  const { db } = deps.db;
  const result = await db.transaction(async (tx) => {
    const [payment] = await tx.select().from(s.payments).where(eq(s.payments.id, paymentId)).for('update');
    if (!payment) throw notFound('Payment');
    if (payment.status === 'success' || payment.status === 'refunded') return { already: true, refund: false, payment };
    await tx
      .update(s.payments)
      .set({ status: 'success', providerPaymentId: info.providerPaymentId ?? null, method: info.method ?? null, raw: (info.raw as object) ?? null })
      .where(eq(s.payments.id, paymentId));
    const [order] = await tx.select().from(s.orders).where(eq(s.orders.id, payment.orderId)).for('update');
    if (order?.status === 'pending_payment') {
      await transition(tx, order.id, 'pay', { type: 'system' }, { paymentId });
      return { already: false, refund: false, payment };
    }
    // Paid after the order was cancelled or another attempt already paid: never keep the money.
    return { already: false, refund: true, payment };
  });
  if (result.refund) await refundPayment(deps, result.payment.id, 'Payment received after the order was closed', { type: 'system' });
  return result;
}

export async function markPaymentFailed(deps: AppDeps, paymentId: string, status: 'failed' | 'user_dropped', raw?: unknown) {
  await deps.db.db
    .update(s.payments)
    .set({ status, raw: (raw as object) ?? null })
    .where(and(eq(s.payments.id, paymentId), eq(s.payments.status, 'created')));
}

/** Full refund of a successful payment through the provider. */
export async function refundPayment(deps: AppDeps, paymentId: string, reason: string, actor: Actor) {
  const { db } = deps.db;
  const [payment] = await db.select().from(s.payments).where(eq(s.payments.id, paymentId));
  if (!payment || payment.status !== 'success') return null;
  const refundId = newId('rfd');
  await db.insert(s.refunds).values({ id: refundId, orderId: payment.orderId, paymentId, amountPaise: payment.amountPaise, reason, createdByType: actor.type, createdById: actor.id ?? null });
  try {
    const r = await deps.payments.refund({ providerOrderId: payment.providerOrderId, refundId, amountPaise: payment.amountPaise, note: reason });
    await db.update(s.refunds).set({ status: r.status, providerRefundId: r.providerRefundId }).where(eq(s.refunds.id, refundId));
    await db.update(s.payments).set({ status: 'refunded' }).where(eq(s.payments.id, paymentId));
  } catch (err) {
    await db.update(s.refunds).set({ status: 'failed' }).where(eq(s.refunds.id, refundId));
    throw new AppError('SERVICE_UNAVAILABLE', 503, `Refund could not be issued: ${err instanceof Error ? err.message : 'provider error'}`);
  }
  return refundId;
}

/** Cancel an order (customer before packing; staff any time before shipping). Releases stock and refunds. */
export async function cancelOrder(deps: AppDeps, orderId: string, reason: string, actor: Actor) {
  const { db } = deps.db;
  await db.transaction(async (tx) => {
    await transition(tx, orderId, 'cancel', actor, { reason }, { cancelReason: reason });
    await release(tx, orderId, actor);
  });
  const paid = await db.select().from(s.payments).where(and(eq(s.payments.orderId, orderId), eq(s.payments.status, 'success')));
  for (const p of paid) await refundPayment(deps, p.id, `Order cancelled: ${reason}`, actor);
}

export async function shipOrder(deps: AppDeps, orderId: string, shipment: { courier: string; trackingNumber: string; trackingUrl?: string | null }, actor: Actor) {
  await deps.db.db.transaction(async (tx) => {
    await transition(tx, orderId, 'ship', actor, shipment, { courier: shipment.courier, trackingNumber: shipment.trackingNumber, trackingUrl: shipment.trackingUrl ?? null });
    await ship(tx, orderId, actor);
  });
}

/**
 * Close unpaid orders whose payment window has passed. Asks the provider first, so a payment
 * whose webhook never arrived is still honoured.
 */
export async function expireUnpaidOrders(deps: AppDeps): Promise<{ expired: number; paid: number }> {
  const { db } = deps.db;
  const due = await db
    .select()
    .from(s.orders)
    .where(and(eq(s.orders.status, 'pending_payment'), lt(s.orders.expiresAt, deps.now())))
    .orderBy(asc(s.orders.expiresAt))
    .limit(200);
  let expired = 0;
  let paid = 0;
  for (const order of due) {
    const attempts = await db.select().from(s.payments).where(eq(s.payments.orderId, order.id)).orderBy(desc(s.payments.createdAt));
    let settled = false;
    for (const p of attempts) {
      const status = await deps.payments.fetchOrder(p.providerOrderId).catch(() => ({ status: 'UNKNOWN' as const }));
      if (status.status === 'PAID') {
        await markPaid(deps, p.id, { providerPaymentId: 'providerPaymentId' in status ? status.providerPaymentId : undefined, method: 'method' in status ? status.method : undefined });
        settled = true;
        paid++;
        break;
      }
    }
    if (settled) continue;
    await db.transaction(async (tx) => {
      const [fresh] = await tx.select({ status: s.orders.status }).from(s.orders).where(eq(s.orders.id, order.id)).for('update');
      if (fresh?.status !== 'pending_payment') return;
      await transition(tx, order.id, 'expire', { type: 'system' });
      await release(tx, order.id);
      await tx.update(s.payments).set({ status: 'expired' }).where(and(eq(s.payments.orderId, order.id), eq(s.payments.status, 'created')));
    });
    expired++;
  }
  return { expired, paid };
}

/** Order as returned to customers and staff. */
export async function orderView(db: DbOrTx | Db, orderId: string) {
  const [order] = await db.select().from(s.orders).where(eq(s.orders.id, orderId));
  if (!order) throw notFound('Order');
  const [items, events, payments, refunds] = await Promise.all([
    db.select({ i: s.orderItems, p: s.products }).from(s.orderItems).innerJoin(s.productVariants, eq(s.productVariants.id, s.orderItems.variantId)).innerJoin(s.products, eq(s.products.id, s.productVariants.productId)).where(eq(s.orderItems.orderId, orderId)),
    db.select().from(s.orderEvents).where(eq(s.orderEvents.orderId, orderId)).orderBy(asc(s.orderEvents.at)),
    db.select().from(s.payments).where(eq(s.payments.orderId, orderId)).orderBy(desc(s.payments.createdAt)),
    db.select().from(s.refunds).where(eq(s.refunds.orderId, orderId)),
  ]);
  const m = (paise: number) => ({ amount: paise, currency: 'INR' as const });
  const latest = payments[0];
  return {
    id: order.id,
    number: order.number,
    status: order.status as OrderStatus,
    placedAt: order.createdAt.toISOString(),
    expiresAt: order.status === 'pending_payment' ? (order.expiresAt?.toISOString() ?? null) : null,
    items: items.map(({ i, p }) => ({
      id: i.id,
      variantId: i.variantId,
      slug: p.slug,
      name: i.nameSnapshot,
      sku: i.skuSnapshot,
      packSize: i.packSize,
      pack: p.pack,
      quantity: i.quantity,
      unitPrice: m(i.unitPricePaise),
      total: m(i.lineTotalPaise),
    })),
    subtotal: m(order.subtotalPaise),
    shipping: m(order.shippingPaise),
    discount: m(order.discountPaise),
    taxIncluded: m(order.taxPaise),
    total: m(order.totalPaise),
    shippingAddress: { ...order.shippingAddress, location: order.shippingAddress.location ? { ...order.shippingAddress.location, directionsUrl: directionsUrl(order.shippingAddress.location.lat, order.shippingAddress.location.lng) } : null },
    delivery: {
      zone: order.shippingZone,
      etaMinDays: order.etaMinDays,
      etaMaxDays: order.etaMaxDays,
      courier: order.courier,
      trackingNumber: order.trackingNumber,
      trackingUrl: order.trackingUrl,
    },
    timeline: {
      placedAt: order.createdAt.toISOString(),
      paidAt: order.paidAt?.toISOString() ?? null,
      packedAt: order.packedAt?.toISOString() ?? null,
      shippedAt: order.shippedAt?.toISOString() ?? null,
      deliveredAt: order.deliveredAt?.toISOString() ?? null,
      cancelledAt: order.cancelledAt?.toISOString() ?? null,
    },
    cancelReason: order.cancelReason,
    payment: latest
      ? {
          id: latest.id,
          provider: latest.provider,
          status: latest.status,
          method: latest.method,
          paymentSessionId: order.status === 'pending_payment' && latest.status === 'created' ? latest.paymentSessionId : null,
        }
      : null,
    refunds: refunds.map((r) => ({ id: r.id, amount: m(r.amountPaise), status: r.status, reason: r.reason, createdAt: r.createdAt.toISOString() })),
    events: events.map((e) => ({ type: e.type, from: e.fromStatus, to: e.toStatus, actorType: e.actorType, at: e.at.toISOString(), data: e.data })),
    note: order.note,
    customerId: order.customerId,
  };
}

export async function orderSummaries(db: DbOrTx, orderIds: string[]) {
  if (orderIds.length === 0) return new Map<string, { count: number; firstName: string; packs: s.PackVisual[] }>();
  const rows = await db
    .select({ orderId: s.orderItems.orderId, name: s.orderItems.nameSnapshot, qty: s.orderItems.quantity, pack: s.products.pack })
    .from(s.orderItems)
    .innerJoin(s.productVariants, eq(s.productVariants.id, s.orderItems.variantId))
    .innerJoin(s.products, eq(s.products.id, s.productVariants.productId))
    .where(inArray(s.orderItems.orderId, orderIds));
  const out = new Map<string, { count: number; firstName: string; packs: s.PackVisual[] }>();
  for (const r of rows) {
    const e = out.get(r.orderId) ?? { count: 0, firstName: r.name, packs: [] };
    e.count += r.qty;
    if (e.packs.length < 3) e.packs.push(r.pack);
    out.set(r.orderId, e);
  }
  return out;
}
