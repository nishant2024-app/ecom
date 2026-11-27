'use client';

import { motion, useReducedMotion } from 'motion/react';
import Link from 'next/link';
import { longDate } from '@/lib/format';
import type { ProductSummary } from '@/lib/types';
import { ProductImage } from '../ProductImage';

export interface FreshItem {
  product: ProductSummary;
  variantId: string;
  packSize: string;
  manufacturedOn: string;
  daysAgo: number;
}

const ago = (d: number) => (d <= 0 ? 'Made today' : d === 1 ? 'Made yesterday' : `Made ${d} days ago`);

/** Batches made in the last three weeks, straight from the batch records: proof the stock is fresh. */
export function FreshThisWeek({ items }: { items: FreshItem[] }) {
  const reduce = useReducedMotion();
  if (!items.length) return null;
  return (
    <section className="overflow-hidden rounded-5 bg-[linear-gradient(120deg,var(--meadow),var(--paper-2))] p-5 md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="inline-flex items-center gap-2 text-[13px] font-bold text-forest">
            <span className="relative flex h-2.5 w-2.5" aria-hidden>
              {!reduce && <span className="absolute inline-flex h-full w-full animate-ping rounded-pill bg-forest opacity-60" />}
              <span className="relative inline-flex h-2.5 w-2.5 rounded-pill bg-forest" />
            </span>
            Live from our batch records
          </p>
          <h2 className="mt-1 text-[22px] font-extrabold tracking-[-0.025em] md:text-[28px]">Fresh from the dairy</h2>
          <p className="text-[14px] text-ink-2 md:text-[15px]">Recently made batches, in stock now. The date on your pack will match.</p>
        </div>
        <Link href="/verify" className="inline-flex min-h-[44px] items-center text-[14px] font-semibold text-forest hover:underline">How to verify your pack →</Link>
      </div>
      <ul className="-mx-5 mt-5 flex snap-x gap-3 overflow-x-auto px-5 pb-1 md:-mx-0 md:px-0">
        {items.map((it, i) => (
          <motion.li
            key={it.product.id}
            initial={reduce ? false : { opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.05 }}
            className="w-[220px] shrink-0 snap-start"
          >
            <Link href={`/p/${it.product.slug}`} className="flex items-center gap-3 rounded-4 bg-paper p-3 shadow-card transition-transform hover:-translate-y-0.5">
              <span className="block h-16 w-16 shrink-0 overflow-hidden rounded-3 bg-paper-2">
                <ProductImage image={it.product.image} pack={it.product.pack} name={it.product.name} size={it.packSize} sizes="64px" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[14px] font-bold">{it.product.name}</span>
                <span className="block text-[12px] text-ink-2">{it.packSize}</span>
                <span className="mt-1 inline-flex rounded-pill bg-meadow px-2 py-0.5 text-[11px] font-bold text-forest" title={longDate(it.manufacturedOn)}>
                  {ago(it.daysAgo)}
                </span>
              </span>
            </Link>
          </motion.li>
        ))}
      </ul>
    </section>
  );
}
