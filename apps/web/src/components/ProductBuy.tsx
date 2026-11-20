'use client';

import { Money } from '@dairy/ui';
import { Gallery } from './Gallery';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { api } from '@/lib/api-client';
import { useCart } from '@/lib/cart';
import { etaText, longDate, monthYear, shelfLife, unitPriceText } from '@/lib/format';
import Link from 'next/link';
import type { ProductDetail, ShippingInfo } from '@/lib/types';

interface Estimate {
  serviceable: boolean;
  state: string | null;
  shipping: ShippingInfo | null;
  freeAbove: { amount: number } | null;
  message: string | null;
}

export function ProductBuy({ product, children }: { product: ProductDetail; children: ReactNode }) {
  const { add, pincode, setPincode } = useCart();
  const reduce = useReducedMotion();
  const [variantId, setVariantId] = useState((product.variants.find((v) => v.inStock) ?? product.variants[0]!).id);
  const [qty, setQty] = useState(1);
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [added, setAdded] = useState(false);
  const shotRef = useRef<HTMLDivElement>(null);
  const v = product.variants.find((x) => x.id === variantId)!;
  const off = v.mrp.amount > v.price.amount ? Math.round(((v.mrp.amount - v.price.amount) / v.mrp.amount) * 100) : 0;

  useEffect(() => {
    if (!/^[1-9]\d{5}$/.test(pincode)) {
      setEstimate(null);
      return;
    }
    const t = setTimeout(() => {
      api<Estimate>(`/v1/store/shipping/estimate?pincode=${pincode}&subtotal=${v.price.amount * qty}`).then(setEstimate).catch(() => setEstimate(null));
    }, 250);
    return () => clearTimeout(t);
  }, [pincode, v.price.amount, qty]);

  useEffect(() => setQty((q) => Math.min(Math.max(1, q), Math.max(1, v.maxPerOrder))), [v.maxPerOrder]);

  function addToCart() {
    add({ variantId: v.id, quantity: qty, slug: product.slug, name: product.name, packSize: v.packSize, pack: product.pack, pricePaise: v.price.amount }, shotRef.current?.getBoundingClientRect());
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
  }

  return (
    <div className="mt-6 grid gap-10 md:grid-cols-12">
      <div className="md:col-span-6" ref={shotRef}>
        <Gallery product={product} size={v.packSize} variantKey={v.id} reduce={!!reduce} />
      </div>

      <div className="md:col-span-6 md:pl-4 md:pt-2">
        {children}
        <div className="mt-6 flex items-baseline gap-3">
          <Money paise={v.price.amount} className="text-[34px] font-bold" />
          {off > 0 && (
            <>
              <Money paise={v.mrp.amount} className="text-lg text-ink-3 line-through" />
              <span className="num rounded-pill bg-meadow px-2.5 py-0.5 text-sm font-bold text-forest">{off}% OFF</span>
            </>
          )}
        </div>
        <p className="mt-1 text-sm text-ink-2">
          Inclusive of GST{v.unitPrice && <> · <span className="num">{unitPriceText(v.unitPrice)}</span></>}
        </p>
        {v.nextBatch && (
          <div className="mt-4 flex items-start gap-3 rounded-4 border border-forest/25 bg-meadow p-3.5">
            <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-pill bg-forest text-[15px] text-on-forest" aria-hidden>✓</span>
            <p className="text-[14px] leading-snug">
              <span className="font-bold">Fresh batch:</span> made on <span className="num font-semibold">{longDate(v.nextBatch.manufacturedOn)}</span>, best before <span className="num font-semibold">{monthYear(v.nextBatch.bestBefore)}</span>.
              <span className="block text-ink-2">We ship the oldest safe batch first and print its code on the pack. <Link href="/verify" className="font-semibold text-forest underline underline-offset-2">Verify a pack</Link></span>
            </p>
          </div>
        )}

        <fieldset className="mt-6">
          <legend className="text-[14px] font-bold">Choose size</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {product.variants.map((x) => (
              <label key={x.id} className={`relative cursor-pointer rounded-3 border-2 px-4 py-2.5 transition-colors ${x.id === variantId ? 'border-forest' : 'border-rule hover:border-ink-3'} ${!x.inStock ? 'opacity-50' : ''}`}>
                <input type="radio" name="variant" value={x.id} checked={x.id === variantId} onChange={() => setVariantId(x.id)} className="sr-only" disabled={!x.inStock} />
                {x.id === variantId && <motion.span layoutId="variant-pill" className="absolute inset-0 rounded-[10px] bg-meadow" transition={{ type: 'spring', stiffness: 400, damping: 30 }} />}
                <span className="relative">
                  {x.packSize} · <Money paise={x.price.amount} />
                  {!x.inStock && ' · sold out'}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="mt-6 flex gap-3">
          <div className="flex h-14 items-center rounded-pill bg-paper-2" role="group" aria-label="Quantity">
            <button type="button" aria-label="One less" onClick={() => setQty((q) => Math.max(1, q - 1))} className="h-full w-12 text-xl">
              −
            </button>
            <span className="num w-8 text-center text-lg" aria-live="polite">
              {qty}
            </span>
            <button type="button" aria-label="One more" disabled={qty >= v.maxPerOrder} onClick={() => setQty((q) => Math.min(v.maxPerOrder, q + 1))} className="h-full w-12 text-xl disabled:text-ink-3">
              +
            </button>
          </div>
          <motion.button type="button" whileTap={{ scale: 0.97 }} onClick={addToCart} disabled={!v.inStock} className="relative flex h-14 flex-1 items-center justify-center overflow-hidden rounded-pill bg-forest text-[17px] font-bold text-on-forest hover:bg-forest-2 disabled:bg-ink-3">
            <AnimatePresence mode="wait" initial={false}>
              <motion.span key={added ? 'added' : 'add'} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -20, opacity: 0 }} transition={{ duration: 0.2 }}>
                {!v.inStock ? 'Out of stock' : added ? 'Added to basket ✓' : `Add to basket · ₹${((v.price.amount * qty) / 100).toLocaleString('en-IN')}`}
              </motion.span>
            </AnimatePresence>
          </motion.button>
        </div>
        {v.lowStock && <p className="mt-2 text-sm text-alert">Only a few left in this size</p>}

        <div className="mt-6 rounded-4 border border-rule p-4">
          <label className="flex flex-wrap items-center gap-3">
            <span className="text-ink-2">Check delivery</span>
            <input
              value={pincode}
              onChange={(e) => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              placeholder="Pincode"
              aria-label="Delivery pincode"
              className="num h-10 w-32 rounded-pill border border-rule bg-paper-2 px-4 focus:border-forest"
            />
          </label>
          <AnimatePresence mode="wait">
            {estimate && (
              <motion.p key={JSON.stringify(estimate.shipping)} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-3 text-base">
                {estimate.serviceable && estimate.shipping ? (
                  <>
                    Arrives <strong className="font-medium">{etaText(estimate.shipping.earliest, estimate.shipping.latest)}</strong>
                    {estimate.state && <> in {estimate.state}</>}.{' '}
                    {estimate.shipping.free ? 'Free shipping.' : estimate.freeAbove ? (
                      <>
                        Shipping <Money paise={estimate.shipping.fee.amount} />, free above <Money paise={estimate.freeAbove.amount} />.
                      </>
                    ) : (
                      <>
                        Shipping <Money paise={estimate.shipping.fee.amount} />.
                      </>
                    )}
                  </>
                ) : (
                  <span className="text-alert">{estimate.message}</span>
                )}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
        <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-5 gap-y-2 rounded-4 bg-paper-2 p-4 text-[14px]">
          <dt className="font-semibold text-ink-3">Keeps</dt>
          <dd>{shelfLife(v.shelfLifeDays)} sealed · batch code and expiry printed on the pack</dd>
          <dt className="font-semibold text-ink-3">Cancel</dt>
          <dd>Free until we pack it, refunded to your payment method</dd>
          <dt className="font-semibold text-ink-3">Pay</dt>
          <dd>UPI, cards, net banking through Cashfree</dd>
        </dl>
      </div>

      {/* Mobile: keep price and the main action in reach while reading the page. */}
      <div className="fixed inset-x-0 bottom-[calc(57px+env(safe-area-inset-bottom))] z-30 border-t border-rule bg-paper/95 px-4 py-2.5 backdrop-blur md:hidden">
        <div className="flex items-center gap-3">
          <div className="min-w-0 leading-tight">
            <p className="num text-[17px] font-bold">₹{((v.price.amount * qty) / 100).toLocaleString('en-IN')}</p>
            <p className="truncate text-[12px] text-ink-2">{v.packSize}{qty > 1 ? ` × ${qty}` : ''}</p>
          </div>
          <button type="button" onClick={addToCart} disabled={!v.inStock} className="ml-auto h-11 flex-1 rounded-pill bg-forest font-bold text-on-forest disabled:bg-ink-3">
            {!v.inStock ? 'Out of stock' : added ? 'Added ✓' : 'Add to cart'}
          </button>
        </div>
      </div>
    </div>
  );
}
