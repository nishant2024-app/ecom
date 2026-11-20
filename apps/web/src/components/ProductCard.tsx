'use client';

import { Money, PackShot, VegMark } from '@dairy/ui';
import { motion } from 'motion/react';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { useCart } from '@/lib/cart';
import { shelfLife } from '@/lib/format';
import type { ProductSummary } from '@/lib/types';

export function ProductCard({ product, priority = false }: { product: ProductSummary; priority?: boolean }) {
  const { add } = useCart();
  const v = product.variants.find((x) => x.inStock) ?? product.variants[0]!;
  const button = useRef<HTMLButtonElement>(null);
  const [hover, setHover] = useState(false);
  const off = v.mrp.amount > v.price.amount ? Math.round(((v.mrp.amount - v.price.amount) / v.mrp.amount) * 100) : 0;

  return (
    <motion.article
      onHoverStart={() => setHover(true)}
      onHoverEnd={() => setHover(false)}
      whileHover={{ y: -6 }}
      transition={{ type: 'spring', stiffness: 300, damping: 24 }}
      className="group relative flex flex-col rounded-4 bg-paper-2 p-3 shadow-card"
    >
      <Link href={`/p/${product.slug}`} className="relative block overflow-hidden rounded-3 bg-paper" aria-label={product.name}>
        <div className="absolute inset-x-0 bottom-0 h-1/2" style={{ background: `radial-gradient(60% 60% at 50% 100%, ${product.pack.color}55, transparent 70%)` }} />
        <motion.div animate={{ rotate: hover ? -4 : 0, scale: hover ? 1.06 : 1 }} transition={{ type: 'spring', stiffness: 220, damping: 18 }} className="relative mx-auto aspect-[200/260] w-[70%] py-4">
          <PackShot kind={product.pack.kind} color={product.pack.color} accent={product.pack.accent} label={product.name} size={v.packSize} className="h-full w-full" />
        </motion.div>
        <div className="absolute left-3 top-3 flex flex-col items-start gap-1.5">
          {off > 0 && <span className="num rounded-pill bg-signal px-2.5 py-0.5 text-xs text-on-signal">−{off}%</span>}
          {v.lowStock && <span className="rounded-pill bg-paper px-2.5 py-0.5 text-xs text-alert">Few left</span>}
          {!v.inStock && <span className="rounded-pill bg-ink px-2.5 py-0.5 text-xs text-paper">Out of stock</span>}
        </div>
        <span className="absolute right-3 top-3 rounded-pill bg-paper/90 px-2.5 py-0.5 text-xs text-ink-2">Keeps {shelfLife(v.shelfLifeDays)}</span>
      </Link>
      <div className="flex flex-1 flex-col px-1 pb-1 pt-3">
        <p className="text-xs uppercase tracking-[0.12em] text-ink-2">{product.category.name}</p>
        <h3 className="mt-1 flex items-start gap-2 text-lg leading-snug">
          {product.isVeg && <span className="mt-1.5"><VegMark /></span>}
          <Link href={`/p/${product.slug}`} className="hover:underline hover:underline-offset-4">
            {product.name}
          </Link>
        </h3>
        <p className="mt-0.5 text-sm text-ink-2">{product.tagline}</p>
        <div className="mt-auto flex items-end justify-between gap-2 pt-4">
          <div>
            <Money paise={v.price.amount} className="text-xl" />
            {off > 0 && <Money paise={v.mrp.amount} className="ml-2 text-sm text-ink-3 line-through" />}
            <p className="text-xs text-ink-2">{product.variants.length > 1 ? `${v.packSize} · ${product.variants.length} sizes` : v.packSize}</p>
          </div>
          <motion.button
            ref={button}
            type="button"
            disabled={!v.inStock}
            whileTap={{ scale: 0.92 }}
            onClick={() =>
              add(
                { variantId: v.id, quantity: 1, slug: product.slug, name: product.name, packSize: v.packSize, pack: product.pack, pricePaise: v.price.amount },
                button.current?.closest('article')?.querySelector('svg')?.getBoundingClientRect() ?? button.current?.getBoundingClientRect(),
              )
            }
            className="flex h-11 items-center gap-1.5 rounded-pill bg-forest px-4 text-base text-on-forest hover:bg-forest-2 disabled:bg-ink-3"
            aria-label={`Add ${product.name} ${v.packSize} to cart`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </svg>
            Add
          </motion.button>
        </div>
      </div>
      {priority && <span className="sr-only">Featured</span>}
    </motion.article>
  );
}
