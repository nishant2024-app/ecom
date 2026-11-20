'use client';

import { Money, VegMark } from '@dairy/ui';
import { motion } from 'motion/react';
import Link from 'next/link';
import { useRef } from 'react';
import { useCart } from '@/lib/cart';
import { shelfLife } from '@/lib/format';
import type { ProductSummary } from '@/lib/types';
import { ProductImage } from './ProductImage';

export function ProductCard({ product, priority = false, sizes = '(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw' }: { product: ProductSummary; priority?: boolean; sizes?: string }) {
  const { add } = useCart();
  const v = product.variants.find((x) => x.inStock) ?? product.variants[0]!;
  const imageRef = useRef<HTMLAnchorElement>(null);
  const off = v.mrp.amount > v.price.amount ? Math.round(((v.mrp.amount - v.price.amount) / v.mrp.amount) * 100) : 0;

  return (
    <article className="group flex h-full flex-col">
      <Link ref={imageRef} href={`/p/${product.slug}`} className="relative block aspect-[4/5] overflow-hidden bg-paper-2" aria-label={product.name}>
        <div className="h-full w-full transition-transform duration-[700ms] ease-[var(--ease)] group-hover:scale-[1.035]">
          <ProductImage image={product.image} pack={product.pack} name={product.name} size={v.packSize} sizes={sizes} priority={priority} />
        </div>
        <div className="label absolute left-0 top-3 flex flex-col items-start gap-1">
          {off > 0 && <span className="num bg-ink px-2 py-1 text-paper">{off}% off</span>}
          {v.lowStock && <span className="bg-paper px-2 py-1 text-alert">Few left</span>}
          {!v.inStock && <span className="bg-paper px-2 py-1 text-ink-2">Sold out</span>}
        </div>
      </Link>
      <div className="flex flex-1 flex-col pt-4">
        <p className="label flex items-center justify-between text-ink-3">
          <span>{product.category.name}</span>
          <span>Keeps {shelfLife(v.shelfLifeDays)}</span>
        </p>
        <h3 className="mt-2 flex items-start gap-2 font-display text-[21px] leading-[1.15]">
          <Link href={`/p/${product.slug}`} className="decoration-1 underline-offset-4 hover:underline">
            {product.name}
          </Link>
          {product.isVeg && <span className="mt-1.5 shrink-0"><VegMark /></span>}
        </h3>
        <p className="mt-1 text-[15px] leading-snug text-ink-2">{product.tagline}</p>
        <div className="mt-auto flex items-end justify-between gap-3 pt-4">
          <div className="leading-tight">
            <Money paise={v.price.amount} className="text-lg" />
            {off > 0 && <Money paise={v.mrp.amount} className="ml-2 text-sm text-ink-3 line-through" />}
            <p className="text-[13px] text-ink-2">{product.variants.length > 1 ? `${v.packSize} · ${product.variants.length} sizes` : v.packSize}</p>
          </div>
          <motion.button
            type="button"
            disabled={!v.inStock}
            whileTap={{ scale: 0.95 }}
            onClick={() =>
              add(
                { variantId: v.id, quantity: 1, slug: product.slug, name: product.name, packSize: v.packSize, pack: product.pack, pricePaise: v.price.amount },
                imageRef.current?.getBoundingClientRect(),
              )
            }
            className="h-10 border border-ink px-4 text-[15px] transition-colors hover:bg-ink hover:text-paper disabled:border-rule disabled:text-ink-3 disabled:hover:bg-transparent"
            aria-label={`Add ${product.name}, ${v.packSize}, to basket`}
          >
            Add
          </motion.button>
        </div>
      </div>
    </article>
  );
}
