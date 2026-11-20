'use client';

import { PackShot } from '@dairy/ui';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import type { ProductDetail } from '@/lib/types';
import { Photo } from './ProductImage';

/** Product photos with thumbnails. Without photos, the drawn pack changes with the selected size. */
export function Gallery({ product, size, variantKey, reduce }: { product: ProductDetail; size: string; variantKey: string; reduce: boolean }) {
  const photos = product.gallery;
  const [index, setIndex] = useState(0);
  if (!photos.length) {
    return (
      <div className="relative grid aspect-[5/6] place-items-center overflow-hidden bg-paper-2 md:aspect-[6/5]">
        <AnimatePresence mode="wait">
          <motion.div
            key={variantKey}
            initial={reduce ? false : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, y: -12 }}
            transition={{ type: 'spring', stiffness: 220, damping: 24 }}
            className="h-[72%]"
          >
            <PackShot kind={product.pack.kind} color={product.pack.color} accent={product.pack.accent} label={product.name} size={size} className="h-full w-auto drop-shadow-[0_24px_24px_rgba(20,39,31,0.25)]" />
          </motion.div>
        </AnimatePresence>
        <div className="absolute inset-x-0 bottom-0 h-[14%] border-t border-rule bg-paper-3/60" aria-hidden />
      </div>
    );
  }
  const current = photos[Math.min(index, photos.length - 1)]!;
  return (
    <div className="grid gap-3 md:grid-cols-[72px_1fr]">
      <div className="relative order-1 aspect-square overflow-hidden bg-paper-2 md:order-2">
        <AnimatePresence initial={false} mode="popLayout">
          <motion.div key={current.url} initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }} className="absolute inset-0">
            <Photo img={current} sizes="(min-width: 768px) 55vw, 100vw" priority={index === 0} className="h-full w-full object-cover" />
          </motion.div>
        </AnimatePresence>
        {photos.length > 1 && (
          <p className="label num absolute bottom-3 right-3 bg-paper px-2 py-1">
            {index + 1} / {photos.length}
          </p>
        )}
      </div>
      {photos.length > 1 && (
        <ul className="order-2 flex gap-2 overflow-x-auto md:order-1 md:flex-col" aria-label="More photos">
          {photos.map((p, i) => (
            <li key={p.url} className="shrink-0">
              <button type="button" onClick={() => setIndex(i)} aria-label={`Photo ${i + 1}: ${p.alt}`} aria-current={i === index} className={`block h-[72px] w-[72px] overflow-hidden border-2 ${i === index ? 'border-ink' : 'border-transparent opacity-70 hover:opacity-100'}`}>
                <Photo img={p} sizes="72px" className="h-full w-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
