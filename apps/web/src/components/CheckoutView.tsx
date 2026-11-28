'use client';

import { Money, PackShot } from '@dairy/ui';
import { motion } from 'motion/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { api, ApiError, hasSession } from '@/lib/api-client';
import { useCart } from '@/lib/cart';
import { etaText } from '@/lib/format';
import type { Address, Order, PaymentStart } from '@/lib/types';
import { AddressForm } from './AddressForm';
import { CouponBox } from './CouponBox';
import { FreeShippingBar, useQuote } from './CartDrawer';

declare global {
  interface Window {
    Cashfree?: (opts: { mode: 'sandbox' | 'production' }) => { checkout: (o: { paymentSessionId: string; redirectTarget?: string }) => Promise<unknown> };
  }
}

function loadCashfree(): Promise<void> {
  if (window.Cashfree) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://sdk.cashfree.com/js/v3/cashfree.js';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Could not load Cashfree'));
    document.head.appendChild(s);
  });
}

/** Send the shopper to pay: Cashfree checkout, or the local test page when payments are mocked. */
export async function startPayment(payment: PaymentStart, router: ReturnType<typeof useRouter>) {
  if (payment.mockCheckoutPath) {
    router.push(payment.mockCheckoutPath);
    return;
  }
  if (!payment.paymentSessionId) throw new Error('Payment could not be started');
  await loadCashfree();
  const cashfree = window.Cashfree!({ mode: payment.environment === 'production' ? 'production' : 'sandbox' });
  await cashfree.checkout({ paymentSessionId: payment.paymentSessionId, redirectTarget: '_self' });
}

export function CheckoutView() {
  const router = useRouter();
  const { items, clear, setPincode, coupon, setCoupon } = useCart();
  const [me, setMe] = useState<{ name: string } | null | 'signed-out'>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addressId, setAddressId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const address = addresses.find((a) => a.id === addressId);
  const lines = useMemo(() => items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })), [items]);
  const { quote } = useQuote(lines, address?.pincode ?? '', true, coupon);
  const idempotency = useRef(crypto.randomUUID());
  useEffect(() => {
    idempotency.current = crypto.randomUUID();
  }, [addressId, JSON.stringify(lines)]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!hasSession()) {
      setMe('signed-out');
      return;
    }
    api<{ name: string }>('/v1/store/me')
      .then(async (m) => {
        setMe(m);
        const { data } = await api<{ data: Address[] }>('/v1/store/me/addresses');
        setAddresses(data);
        const def = data.find((a) => a.isDefault) ?? data[0];
        setAddressId(def?.id ?? null);
        setAdding(data.length === 0);
      })
      .catch((e) => setMe(e instanceof ApiError && e.problem.status === 401 ? 'signed-out' : null));
  }, []);

  useEffect(() => {
    if (address) setPincode(address.pincode);
  }, [address, setPincode]);

  async function placeOrder() {
    if (!addressId) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ order: Order; payment: PaymentStart }>('/v1/store/orders', {
        method: 'POST',
        idempotencyKey: idempotency.current,
        body: JSON.stringify({ lines, addressId, ...(quote?.coupon ? { couponCode: quote.coupon.code } : {}) }),
      });
      clear();
      setCoupon('');
      await startPayment(r.payment, router);
    } catch (e) {
      setError(e instanceof ApiError ? (e.problem.detail ?? e.problem.title) : e instanceof Error ? e.message : 'Could not place the order');
      setBusy(false);
    }
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <h1 className="font-extrabold tracking-[-0.02em] text-4xl">Your basket is empty</h1>
        <Link href="/products" className="mt-6 inline-block bg-forest px-6 py-3 text-on-forest rounded-pill">
          Browse products
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1240px] px-4 py-10 md:px-6">
      <h1 className="font-extrabold tracking-[-0.02em] text-[clamp(36px,5vw,60px)] leading-none">Checkout</h1>
      <div className="mt-8 grid gap-8 lg:grid-cols-12">
        <section className="space-y-6 lg:col-span-7">
          <div className="bg-paper-2 p-5 md:p-6 rounded-4">
            <h2 className="flex items-center gap-3 text-xl font-bold">
              <span className="num grid h-8 w-8 place-items-center bg-forest text-sm text-on-forest rounded-pill">1</span> Account
            </h2>
            {me === null && <p className="mt-3 text-ink-2">Checking…</p>}
            {me === 'signed-out' && (
              <div className="mt-3">
                <p className="text-ink-2">Sign in so you can track your order and cancel it if plans change.</p>
                <Link href="/signin?next=/checkout" className="mt-4 inline-block bg-forest px-6 py-3 text-on-forest rounded-pill">
                  Sign in to continue
                </Link>
              </div>
            )}
            {me && me !== 'signed-out' && <p className="mt-2 text-ink-2">Signed in as {me.name}</p>}
          </div>

          <div className={`rounded-4 bg-paper-2 p-5 md:p-6 ${me && me !== 'signed-out' ? '' : 'pointer-events-none opacity-50'}`}>
            <h2 className="flex items-center gap-3 text-xl font-bold">
              <span className="num grid h-8 w-8 place-items-center bg-forest text-sm text-on-forest rounded-pill">2</span> Delivery address
            </h2>
            <div className="mt-4 space-y-3">
              {addresses.map((a) => (
                <label key={a.id} className={`flex cursor-pointer gap-3 rounded-3 border-2 bg-paper p-4 ${a.id === addressId ? 'border-forest' : 'border-rule'}`}>
                  <input type="radio" name="address" checked={a.id === addressId} onChange={() => setAddressId(a.id)} className="mt-1 accent-[var(--forest)]" />
                  <span>
                    <span className="block">
                      {a.name} {a.label && <span className="ml-2 bg-paper-2 px-2 py-0.5 text-xs rounded-4">{a.label}</span>}
                    </span>
                    <span className="block text-sm text-ink-2">
                      {[a.line1, a.line2, a.landmark, a.city, a.state].filter(Boolean).join(', ')} – <span className="num">{a.pincode}</span>
                    </span>
                    <span className="num block text-sm text-ink-2">{a.phone}</span>
                  </span>
                </label>
              ))}
              {adding ? (
                <div className="bg-paper p-4">
                  <AddressForm
                    defaultName={me && me !== 'signed-out' ? me.name : ''}
                    onCancel={addresses.length ? () => setAdding(false) : undefined}
                    onSaved={(a) => {
                      setAddresses((list) => [...list.map((x) => ({ ...x, isDefault: false })), a]);
                      setAddressId(a.id);
                      setAdding(false);
                    }}
                  />
                </div>
              ) : (
                <button type="button" onClick={() => setAdding(true)} className="text-forest underline underline-offset-4">
                  + Add a new address
                </button>
              )}
            </div>
          </div>
        </section>

        <aside className="lg:col-span-5">
          <div className="sticky top-24 border border-rule bg-paper p-5 md:p-6 rounded-4">
            <h2 className="text-xl font-bold">Order summary</h2>
            <ul className="mt-4 space-y-3">
              {items.map((i) => {
                const line = quote?.lines.find((l) => l.variantId === i.variantId);
                return (
                  <li key={i.variantId} className="flex items-center gap-3">
                    <div className="relative w-12 shrink-0">
                      <PackShot kind={i.pack.kind} color={i.pack.color} accent={i.pack.accent} label={i.name} className="h-16 w-12" />
                      <span className="num absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center bg-forest px-1 text-xs text-on-forest rounded-pill">{i.quantity}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate">{i.name}</p>
                      <p className="text-sm text-ink-2">{i.packSize}</p>
                      {line?.problem && <p className="text-sm text-alert">{line.problem === 'out_of_stock' ? 'Out of stock' : `Only ${line.maxQuantity} available`}</p>}
                    </div>
                    <Money paise={line?.total.amount ?? i.pricePaise * i.quantity} />
                  </li>
                );
              })}
            </ul>
            {quote && (
              <div className="mt-5 space-y-3 rule-t pt-4">
                <FreeShippingBar quote={quote} />
                <CouponBox quote={quote} />
                <dl className="space-y-1.5">
                  <div className="flex justify-between">
                    <dt className="text-ink-2">Subtotal</dt>
                    <dd>
                      <Money paise={quote.subtotal.amount} />
                    </dd>
                  </div>
                  {quote.discount.amount > 0 && (
                    <div className="flex justify-between text-forest">
                      <dt>Coupon {quote.coupon?.code}</dt>
                      <dd>
                        −<Money paise={quote.discount.amount} />
                      </dd>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <dt className="text-ink-2">Shipping {quote.shipping && <span className="text-sm">({quote.shipping.zone})</span>}</dt>
                    <dd>{quote.shipping ? quote.shipping.free ? 'Free' : <Money paise={quote.shipping.fee.amount} /> : '—'}</dd>
                  </div>
                  <div className="flex justify-between text-sm text-ink-2">
                    <dt>Includes GST</dt>
                    <dd>
                      <Money paise={quote.taxIncluded.amount} />
                    </dd>
                  </div>
                  <div className="flex justify-between pt-2 text-2xl font-bold">
                    <dt>Total</dt>
                    <dd>
                      <Money paise={quote.total.amount} />
                    </dd>
                  </div>
                </dl>
                {quote.shipping && <p className="text-sm text-ink-2">Arrives {etaText(quote.shipping.earliest, quote.shipping.latest)}</p>}
                {quote.shippingError && <p className="text-sm text-alert">{quote.shippingError}</p>}
              </div>
            )}
            {error && (
              <p role="alert" className="mt-4 bg-paper-2 p-3 text-alert rounded-4">
                {error}
              </p>
            )}
            <motion.button
              type="button"
              whileTap={{ scale: 0.98 }}
              onClick={placeOrder}
              disabled={busy || !addressId || !quote?.ok || me === 'signed-out'}
              className="mt-5 h-14 w-full bg-signal text-lg font-medium text-on-signal hover:brightness-95 disabled:opacity-50 rounded-pill"
            >
              {busy ? 'Starting payment…' : quote ? `Pay ₹${(quote.total.amount / 100).toLocaleString('en-IN')}` : 'Pay'}
            </motion.button>
            <p className="mt-3 text-center text-xs text-ink-2">Secure payment by Cashfree. UPI, cards, net banking.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
