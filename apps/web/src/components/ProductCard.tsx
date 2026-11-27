'use client';

import { VegMark } from '@dairy/ui';
import { AnimatePresence, motion } from 'motion/react';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { useCart } from '@/lib/cart';
import { shelfLife, unitPriceText } from '@/lib/format';
import type { ProductSummary } from '@/lib/types';
import { CheckIcon, MinusIcon, PlusIcon } from './icons';
import { ProductImage } from './ProductImage';

const rupees = (p: number) => `₹${(p / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

export function ProductCard({ product, priority = false, sizes = '(min-width: 1024px) 22vw, 50vw' }: { product: ProductSummary; priority?: boolean; sizes?: string }) {
  const { add, items, setQuantity } = useCart();
  const [variantId, setVariantId] = useState((product.variants.find((x) => x.inStock) ?? product.variants[0]!).id);
  const v = product.variants.find((x) => x.id === variantId) ?? product.variants[0]!;
  const imageRef = useRef<HTMLAnchorElement>(null);
  const inCart = items.find((i) => i.variantId === v.id)?.quantity ?? 0;
  const save = v.mrp.amount - v.price.amount;

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-4 border border-rule bg-paper transition-shadow duration-[var(--dur-2)] hover:shadow-card">
      <Link ref={imageRef} href={`/p/${product.slug}`} className="relative block aspect-square overflow-hidden bg-paper-2" aria-label={product.name}>
        <div className="h-full w-full transition-transform duration-500 ease-[var(--ease)] group-hover:scale-[1.04]">
          <ProductImage image={product.image} pack={product.pack} name={product.name} size={v.packSize} sizes={sizes} priority={priority} />
        </div>
        <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-pill bg-meadow px-2 py-1 text-[11px] font-semibold text-forest">
          <CheckIcon size={12} /> Keeps {shelfLife(v.shelfLifeDays)}
        </span>
        {v.lowStock && <span className="absolute left-2 top-2 rounded-pill bg-paper px-2 py-1 text-[11px] font-semibold text-alert">Only few left</span>}
      </Link>
      <div className="flex flex-1 flex-col p-3 md:p-4">
        <p className="flex items-center justify-between gap-2 text-[12px] text-ink-3">
          <span className="truncate">{product.category.name}</span>
          {product.rating && (
            <span className="inline-flex shrink-0 items-center gap-0.5 font-semibold text-ink-2" aria-label={`Rated ${product.rating.average} out of 5 from ${product.rating.count} reviews`}>
              <span className="text-[#e3a008]" aria-hidden>
                ★
              </span>
              {product.rating.average.toFixed(1)} <span className="font-normal text-ink-3">({product.rating.count})</span>
            </span>
          )}
        </p>
        <h3 className="mt-0.5 flex items-start gap-1.5 text-[15px] font-bold leading-snug md:text-base">
          <Link href={`/p/${product.slug}`} className="line-clamp-2 py-0.5 hover:text-forest">
            {product.name}
          </Link>
          {product.isVeg && (
            <span className="mt-1 shrink-0">
              <VegMark />
            </span>
          )}
        </h3>
        {product.variants.length > 1 ? (
          <div className="mt-1.5 flex flex-wrap gap-1.5" role="radiogroup" aria-label={`${product.name} size`}>
            {product.variants.map((x) => (
              <button
                key={x.id}
                type="button"
                role="radio"
                aria-checked={x.id === v.id}
                onClick={() => setVariantId(x.id)}
                className={`min-h-[32px] rounded-2 border px-2.5 py-1 text-[12px] font-medium transition-colors ${x.id === v.id ? 'border-forest bg-meadow text-forest' : 'border-rule text-ink-2 hover:border-ink-3'} ${x.inStock ? '' : 'line-through opacity-60'}`}
              >
                {x.packSize}
              </button>
            ))}
          </div>
        ) : (
          <p className="mt-0.5 text-[13px] text-ink-2">{v.packSize}</p>
        )}
        <p className="num mt-1.5 flex items-baseline justify-between gap-2 text-[12px]">
          {save > 0 ? <span className="text-[13px] font-bold text-forest">{rupees(save)} OFF</span> : <span />}
          <span className="text-ink-3">{unitPriceText(v.unitPrice)}</span>
        </p>
        <div className="mt-auto pt-3">
          <div className="flex h-12 items-center justify-between gap-2 rounded-pill bg-paper-2 pl-4 pr-1">
            <p className="num leading-none">
              <span className="text-[17px] font-bold">{rupees(v.price.amount)}</span>
              {save > 0 && <span className="ml-1.5 text-[12px] text-ink-3 line-through">{rupees(v.mrp.amount)}</span>}
            </p>
            {!v.inStock ? (
              <span className="pr-3 text-[13px] font-semibold text-ink-3">Sold out</span>
            ) : (
              <AnimatePresence mode="popLayout" initial={false}>
                {inCart === 0 ? (
                  <motion.button
                    key="add"
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.6, opacity: 0 }}
                    whileTap={{ scale: 0.9 }}
                    type="button"
                    onClick={() =>
                      add(
                        { variantId: v.id, quantity: 1, slug: product.slug, name: product.name, packSize: v.packSize, pack: product.pack, pricePaise: v.price.amount },
                        imageRef.current?.getBoundingClientRect(),
                      )
                    }
                    className="grid h-10 w-10 place-items-center rounded-pill bg-forest text-on-forest hover:bg-forest-2"
                    aria-label={`Add ${product.name}, ${v.packSize}, to cart`}
                  >
                    <PlusIcon />
                  </motion.button>
                ) : (
                  <motion.div
                    key="step"
                    initial={{ width: 40, opacity: 0 }}
                    animate={{ width: 104, opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex h-10 items-center justify-between overflow-hidden rounded-pill bg-forest text-on-forest"
                  >
                    <button type="button" onClick={() => setQuantity(v.id, inCart - 1)} className="grid h-10 w-9 place-items-center" aria-label={`One less ${product.name}`}>
                      <MinusIcon size={16} />
                    </button>
                    <span className="num text-[15px] font-bold" aria-live="polite">
                      {inCart}
                    </span>
                    <button
                      type="button"
                      disabled={inCart >= v.maxPerOrder}
                      onClick={() => setQuantity(v.id, inCart + 1)}
                      className="grid h-10 w-9 place-items-center disabled:opacity-40"
                      aria-label={`One more ${product.name}`}
                    >
                      <PlusIcon size={16} />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
