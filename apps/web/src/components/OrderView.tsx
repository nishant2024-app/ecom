'use client';

import { Money, PackShot } from '@dairy/ui';
import { motion, useReducedMotion } from 'motion/react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api-client';
import { dateTime, shortDate, STATUS_LABEL } from '@/lib/format';
import type { Order, PaymentStart } from '@/lib/types';
import { startPayment } from './CheckoutView';

const STEPS: { key: keyof Order['timeline']; label: string }[] = [
  { key: 'placedAt', label: 'Placed' },
  { key: 'paidAt', label: 'Paid' },
  { key: 'packedAt', label: 'Packed' },
  { key: 'shippedAt', label: 'Shipped' },
  { key: 'deliveredAt', label: 'Delivered' },
];

/** A parcel whose flaps close: plays once when the order is confirmed. */
function Parcel({ done }: { done: boolean }) {
  const reduce = useReducedMotion();
  return (
    <svg viewBox="0 0 120 100" className="h-24 w-28" aria-hidden>
      <path d="M20 40 h80 v50 H20 Z" fill="var(--signal)" />
      <path d="M20 40 h80 v50 H20 Z" fill="none" stroke="var(--forest)" strokeWidth="3" strokeLinejoin="round" />
      <motion.path d="M20 40 L8 22 L60 22 L60 40 Z" fill="#d79a2e" stroke="var(--forest)" strokeWidth="3" strokeLinejoin="round" style={{ originX: '20px', originY: '40px' }} initial={reduce ? false : { rotate: -70 }} animate={{ rotate: done ? 0 : -70 }} transition={{ delay: 0.3, type: 'spring', stiffness: 120, damping: 12 }} />
      <motion.path d="M100 40 L112 22 L60 22 L60 40 Z" fill="#c98a2b" stroke="var(--forest)" strokeWidth="3" strokeLinejoin="round" style={{ originX: '100px', originY: '40px' }} initial={reduce ? false : { rotate: 70 }} animate={{ rotate: done ? 0 : 70 }} transition={{ delay: 0.5, type: 'spring', stiffness: 120, damping: 12 }} />
      <motion.path d="M48 64 l9 9 l17 -19" fill="none" stroke="var(--forest)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: done ? 1 : 0 }} transition={{ delay: 0.9, duration: 0.5 }} />
    </svg>
  );
}

export function OrderView({ id }: { id: string }) {
  const router = useRouter();
  const placed = useSearchParams().get('placed');
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => api<Order>(`/v1/store/orders/${id}`).then(setOrder), [id]);
  useEffect(() => {
    load().catch((e) => setError(e instanceof ApiError ? (e.problem.status === 401 ? 'Sign in to see this order.' : (e.problem.detail ?? e.problem.title)) : 'Could not load the order'));
  }, [load]);
  // While waiting for the payment webhook, poll for a minute.
  useEffect(() => {
    if (order?.status !== 'pending_payment') return;
    let n = 0;
    const t = setInterval(() => {
      n += 1;
      if (n > 30) clearInterval(t);
      void load();
    }, 2000);
    return () => clearInterval(t);
  }, [order?.status, load]);

  if (error)
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <p className="text-lg">{error}</p>
        <Link href={`/signin?next=/orders/${id}`} className="mt-4 inline-block underline">
          Sign in
        </Link>
      </div>
    );
  if (!order) return <div className="mx-auto max-w-xl px-4 py-24 text-center text-ink-2">Loading your order…</div>;

  const done = ['confirmed', 'packed', 'shipped', 'delivered'].includes(order.status);
  const reached = STEPS.filter((s) => order.timeline[s.key]).length;
  const cancelled = order.status === 'cancelled' || order.status === 'refunded';

  async function cancel() {
    if (!confirm('Cancel this order? The full amount is refunded to your payment method.')) return;
    setBusy(true);
    try {
      setOrder(await api<Order>(`/v1/store/orders/${id}/cancel`, { method: 'POST', body: JSON.stringify({}) }));
    } catch (e) {
      alert(e instanceof ApiError ? (e.problem.detail ?? e.problem.title) : 'Could not cancel');
    } finally {
      setBusy(false);
    }
  }
  async function payAgain() {
    setBusy(true);
    try {
      const r = await api<{ payment: PaymentStart }>(`/v1/store/orders/${id}/pay`, { method: 'POST' });
      await startPayment(r.payment, router);
    } catch (e) {
      alert(e instanceof ApiError ? (e.problem.detail ?? e.problem.title) : 'Could not start payment');
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-10 md:px-6">
      <div className="flex flex-col items-start gap-6 bg-forest p-6 text-on-forest md:flex-row md:items-center md:p-10">
        {!cancelled && <Parcel done={done} />}
        <div className="flex-1">
          <p className="num text-sm text-on-forest/70">Order {order.number}</p>
          <h1 className="mt-1 font-display text-[clamp(32px,4vw,52px)] leading-tight">
            {order.status === 'pending_payment'
              ? 'Waiting for your payment'
              : cancelled
                ? 'Order cancelled'
                : order.status === 'delivered'
                  ? 'Delivered. Enjoy!'
                  : placed
                    ? 'Thank you! Your order is confirmed.'
                    : STATUS_LABEL[order.status]}
          </h1>
          <p className="mt-2 text-on-forest/80">
            {order.status === 'pending_payment' && order.expiresAt && <>We&rsquo;re holding your items until {dateTime(order.expiresAt)}.</>}
            {done && order.status !== 'delivered' && <>Arrives in {order.delivery.etaMinDays}–{order.delivery.etaMaxDays} days from dispatch. The courier tracking link appears on this page when it ships.</>}
            {cancelled && order.cancelReason}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {order.status === 'pending_payment' && (
            <button type="button" onClick={payAgain} disabled={busy} className=" bg-signal px-6 py-3 text-on-signal">
              Pay now
            </button>
          )}
          {order.canCancel && (
            <button type="button" onClick={cancel} disabled={busy} className=" border border-on-forest/40 px-5 py-3">
              Cancel order
            </button>
          )}
        </div>
      </div>

      {!cancelled && (
        <ol className="mt-8 grid grid-cols-5 gap-2" aria-label="Order progress">
          {STEPS.map((s, i) => {
            const at = order.timeline[s.key];
            return (
              <li key={s.key} className="relative">
                <div className="h-1.5 overflow-hidden bg-paper-3">
                  <motion.div className="h-full bg-forest" initial={{ width: 0 }} animate={{ width: i < reached ? '100%' : '0%' }} transition={{ delay: 0.15 * i, duration: 0.5 }} />
                </div>
                <p className={`mt-2 text-sm ${at ? 'text-ink' : 'text-ink-3'}`}>{s.label}</p>
                {at && <p className="num text-xs text-ink-2">{dateTime(at)}</p>}
              </li>
            );
          })}
        </ol>
      )}

      <div className="mt-10 grid gap-8 md:grid-cols-12">
        <section className="md:col-span-7">
          <h2 className="text-xl">Items</h2>
          <ul className="mt-3 divide-y divide-rule border border-rule bg-paper">
            {order.items.map((i) => (
              <li key={i.id} className="flex items-center gap-4 p-4">
                <PackShot kind={i.pack.kind} color={i.pack.color} accent={i.pack.accent} label={i.name} className="h-16 w-12 shrink-0" />
                <div className="flex-1">
                  <Link href={`/p/${i.slug}`} className="hover:underline">
                    {i.name}
                  </Link>
                  <p className="text-sm text-ink-2">
                    {i.packSize} × <span className="num">{i.quantity}</span>
                  </p>
                </div>
                <Money paise={i.total.amount} />
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-1 px-1">
            <div className="flex justify-between">
              <dt className="text-ink-2">Subtotal</dt>
              <dd><Money paise={order.subtotal.amount} /></dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-2">Shipping</dt>
              <dd>{order.shipping.amount ? <Money paise={order.shipping.amount} /> : 'Free'}</dd>
            </div>
            <div className="flex justify-between text-xl">
              <dt>Total</dt>
              <dd><Money paise={order.total.amount} /></dd>
            </div>
          </dl>
        </section>
        <aside className="space-y-4 md:col-span-5">
          <div className=" bg-paper-2 p-5">
            <h2 className="text-sm uppercase tracking-[0.12em] text-ink-2">Delivering to</h2>
            <p className="mt-2">{order.shippingAddress.name}</p>
            <p className="text-ink-2">
              {[order.shippingAddress.line1, order.shippingAddress.line2, order.shippingAddress.landmark, order.shippingAddress.city, order.shippingAddress.state].filter(Boolean).join(', ')} – <span className="num">{order.shippingAddress.pincode}</span>
            </p>
          </div>
          {order.delivery.trackingNumber && (
            <div className=" bg-paper-2 p-5">
              <h2 className="text-sm uppercase tracking-[0.12em] text-ink-2">Tracking</h2>
              <p className="mt-2">
                {order.delivery.courier} · <span className="num">{order.delivery.trackingNumber}</span>
              </p>
              {order.delivery.trackingUrl && (
                <a href={order.delivery.trackingUrl} className="mt-2 inline-block underline" target="_blank" rel="noreferrer">
                  Track with courier
                </a>
              )}
            </div>
          )}
          <div className=" bg-paper-2 p-5">
            <h2 className="text-sm uppercase tracking-[0.12em] text-ink-2">Payment</h2>
            <p className="mt-2">{order.payment ? `${order.payment.status === 'success' ? 'Paid' : order.payment.status === 'refunded' ? 'Refunded' : 'Not paid yet'}${order.payment.method ? ` · ${order.payment.method.toUpperCase()}` : ''}` : '—'}</p>
            {order.refunds.map((r) => (
              <p key={r.id} className="mt-1 text-sm text-ink-2">
                Refund <Money paise={r.amount.amount} /> · {r.status}
              </p>
            ))}
            <p className="mt-2 text-xs text-ink-2">Placed {shortDate(order.placedAt)}</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
