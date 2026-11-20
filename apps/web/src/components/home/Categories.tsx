'use client';

import { PackShot } from '@dairy/ui';
import { motion } from 'motion/react';
import Link from 'next/link';
import type { Category } from '@/lib/types';

const fan = [
  { rest: { x: -36, rotate: -10 }, hover: { x: -64, rotate: -18 } },
  { rest: { x: 0, rotate: 0 }, hover: { x: 0, rotate: 0, y: -10 } },
  { rest: { x: 36, rotate: 10 }, hover: { x: 64, rotate: 18 } },
];

export function Categories({ categories }: { categories: Category[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {categories.map((c, i) => (
        <motion.div key={c.slug} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }} transition={{ delay: i * 0.08, duration: 0.6 }}>
          <motion.div initial="rest" whileHover="hover" animate="rest" className="h-full">
            <Link href={`/products?category=${c.slug}`} className="relative flex h-full flex-col overflow-hidden rounded-4 p-5" style={{ background: `linear-gradient(160deg, ${c.packs[0]?.color ?? '#E9B44C'}33, var(--paper-2) 60%)` }}>
              <div className="relative mx-auto h-44 w-full">
                {c.packs.slice(0, 3).map((p, j) => (
                  <motion.div
                    key={j}
                    variants={{ rest: fan[j]!.rest, hover: fan[j]!.hover }}
                    transition={{ type: 'spring', stiffness: 260, damping: 18 }}
                    className="absolute bottom-0 left-1/2 w-24 -translate-x-1/2"
                    style={{ zIndex: j === 1 ? 2 : 1 }}
                  >
                    <PackShot kind={p.kind} color={p.color} accent={p.accent} label={c.name} className="w-full drop-shadow-md" />
                  </motion.div>
                ))}
              </div>
              <div className="mt-4 flex items-end justify-between gap-2">
                <div>
                  <h3 className="font-display text-2xl">{c.name}</h3>
                  <p className="mt-1 text-sm text-ink-2">{c.blurb}</p>
                </div>
                <motion.span variants={{ rest: { x: 0 }, hover: { x: 4 } }} className="grid h-10 w-10 shrink-0 place-items-center rounded-pill bg-forest text-on-forest" aria-hidden>
                  →
                </motion.span>
              </div>
              <p className="num mt-3 text-xs text-ink-2">{c.productCount} products</p>
            </Link>
          </motion.div>
        </motion.div>
      ))}
    </div>
  );
}
