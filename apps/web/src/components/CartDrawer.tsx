'use client';

import { Money, PackShot } from '@dairy/ui';
import { AnimatePresence, motion } from 'motion/react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { api, ApiError } from '@/lib/api-client';
import { useCart } from '@/lib/cart';
import { etaText } from '@/lib/format';
import type { Quote } from '@/lib/types';

export function useQuote(lines: { variantId: string; quantity: number }[], pincode: string, enabled = true) {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const key = JSON.stringify([lines.map((l) => [l.variantId, l.quantity]), pincode]);
  useEffect(() => {
    if (!enabled || lines.length === 0) {
      setQuote(null);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    const t = setTimeout(() => {
      api<Quote>('/v1/store/checkout/quote', { method: 'POST', body: JSON.stringify({ lines, ...(/^[1-9]\d{5}$/.test(pincode) ? { pincode } : {}) }), signal: ctrl.signal })
        .then((q) => {
          setQuote(q);
          setError(null);
        })
        .catch((e) => {
          if (e?.name !== 'AbortError') setError(e instanceof ApiError ? (e.problem.detail ?? e.problem.title) : 'Could not price your cart');
        })
        .finally(() => setLoading(false));
    }, 200);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);
  return { quote, error, loading };
}

export function FreeShippingBar({ quote }: { quote: Quote }) {
  const s = quote.shipping;
  if (!s) return null;
  const target = quote.subtotal.amount + s.remainingForFree.amount;
  const pct = s.free ? 100 : target > 0 ? Math.min(100, (quote.subtotal.amount / target) * 100) : 0;
  if (!s.free && s.remainingForFree.amount === 0) return null;
  return (
    <div>
      <p className="text-sm">
        {s.free ? (
          <>Free shipping unlocked</>
        ) : (
          <>
            Add <Money paise={s.remainingForFree.amount} /> more for free shipping
          </>
        )}
      </p>
      <div className="mt-2 h-2 overflow-hidden bg-paper-3">
        <motion.div className="h-full bg-signal" initial={false} animate={{ width: `${pct}%` }} transition={{ type: 'spring', stiffness: 120, damping: 20 }} />
      </div>
    </div>
  );
}

export function CartDrawer() {
  const { items, open, setOpen, setQuantity, remove, pincode, setPincode } = useCart();
  const lines = items.map((i) => ({ variantId: i.variantId, quantity: i.quantity }));
  const { quote, error } = useQuote(lines, pincode, open);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, setOpen]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50">
          <motion.div className="absolute inset-0 bg-ink/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="cart-title"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 280, damping: 32 }}
            className="absolute right-0 top-0 flex h-full w-full max-w-[440px] flex-col bg-paper shadow-float md:right-3 md:top-3 md:h-[calc(100%-24px)] md:"
          >
            <div className="flex items-center justify-between px-5 py-4 rule-b">
              <h2 id="cart-title" className="font-display text-2xl">
                Your basket
              </h2>
              <button ref={closeRef} type="button" onClick={() => setOpen(false)} aria-label="Close cart" className="grid h-10 w-10 place-items-center hover:bg-paper-2">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {items.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
                <div className="flex items-end -space-x-6">
                  <PackShot kind="jar" color="#E9B44C" accent="#14432F" label="Ghee" className="h-28 w-24 -rotate-6" />
                  <PackShot kind="tin" color="#F2EBDD" accent="#14432F" label="Powder" className="h-32 w-28" />
                  <PackShot kind="tetra" color="#F1A43C" accent="#7A2E12" label="Kesar" className="h-28 w-24 rotate-6" />
                </div>
                <p className="mt-6 font-display text-xl">Nothing here yet</p>
                <p className="mt-1 text-ink-2">Ghee, milk powder and mithai keep for months. Stock the pantry.</p>
                <Link href="/products" onClick={() => setOpen(false)} className="mt-6 bg-forest px-6 py-3 text-on-forest">
                  Browse products
                </Link>
              </div>
            ) : (
              <>
                <ul className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
                  <AnimatePresence initial={false}>
                    {items.map((item) => {
                      const line = quote?.lines.find((l) => l.variantId === item.variantId);
                      const max = Math.max(1, line?.maxQuantity ?? 10);
                      return (
                        <motion.li key={item.variantId} layout initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30, height: 0 }} className="flex gap-3 bg-paper-2 p-3">
                          <Link href={`/p/${item.slug}`} onClick={() => setOpen(false)} className="w-16 shrink-0">
                            <PackShot kind={item.pack.kind} color={item.pack.color} accent={item.pack.accent} label={item.name} size={item.packSize} className="h-20 w-16" />
                          </Link>
                          <div className="flex min-w-0 flex-1 flex-col">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="leading-snug">{item.name}</p>
                                <p className="text-sm text-ink-2">{item.packSize}</p>
                              </div>
                              <Money paise={line?.total.amount ?? item.pricePaise * item.quantity} />
                            </div>
                            {line?.problem && <p className="mt-1 text-sm text-alert">{line.problem === 'out_of_stock' ? 'Out of stock' : line.problem === 'unavailable' ? 'No longer sold' : `Only ${line.maxQuantity} available`}</p>}
                            <div className="mt-auto flex items-center justify-between pt-2">
                              <div className="flex items-center border border-rule bg-paper">
                                <button type="button" aria-label={`One less ${item.name}`} onClick={() => setQuantity(item.variantId, item.quantity - 1)} className="h-8 w-8 text-lg">
                                  −
                                </button>
                                <span className="num w-6 text-center" aria-live="polite">
                                  {item.quantity}
                                </span>
                                <button type="button" aria-label={`One more ${item.name}`} disabled={item.quantity >= max} onClick={() => setQuantity(item.variantId, item.quantity + 1)} className="h-8 w-8 text-lg disabled:text-ink-3">
                                  +
                                </button>
                              </div>
                              <button type="button" onClick={() => remove(item.variantId)} className="text-sm text-ink-2 underline underline-offset-2">
                                Remove
                              </button>
                            </div>
                          </div>
                        </motion.li>
                      );
                    })}
                  </AnimatePresence>
                </ul>
                <div className="space-y-3 px-5 py-4 rule-t">
                  <label className="flex items-center gap-2 text-sm text-ink-2">
                    Deliver to
                    <input
                      value={pincode}
                      onChange={(e) => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      inputMode="numeric"
                      placeholder="Pincode"
                      aria-label="Delivery pincode"
                      className="num h-9 w-28 border border-rule bg-paper px-3 text-ink"
                    />
                    {quote?.shipping && <span>arrives {etaText(quote.shipping.earliest, quote.shipping.latest)}</span>}
                    {quote?.shippingError && <span className="text-alert">{quote.shippingError}</span>}
                  </label>
                  {quote && <FreeShippingBar quote={quote} />}
                  <dl className="space-y-1">
                    <div className="flex justify-between">
                      <dt className="text-ink-2">Subtotal</dt>
                      <dd>{quote ? <Money paise={quote.subtotal.amount} /> : '…'}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-ink-2">Shipping</dt>
                      <dd>{quote?.shipping ? quote.shipping.free ? 'Free' : <Money paise={quote.shipping.fee.amount} /> : <span className="text-ink-3">enter pincode</span>}</dd>
                    </div>
                    <div className="flex justify-between pt-1 text-lg">
                      <dt>Total</dt>
                      <dd>{quote ? <Money paise={quote.total.amount} /> : '…'}</dd>
                    </div>
                  </dl>
                  {error && <p className="text-sm text-alert">{error}</p>}
                  <Link
                    href="/checkout"
                    onClick={() => setOpen(false)}
                    aria-disabled={quote ? quote.lines.some((l) => l.problem) : false}
                    className="flex h-13 w-full items-center justify-center bg-signal py-3.5 text-lg font-medium text-on-signal hover:brightness-95 aria-disabled:pointer-events-none aria-disabled:opacity-50"
                  >
                    Checkout
                  </Link>
                  <p className="text-center text-xs text-ink-2">Prices include GST. Pay with UPI, cards or net banking.</p>
                </div>
              </>
            )}
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}
