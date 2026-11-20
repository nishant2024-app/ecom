'use client';

import { PackShot } from '@dairy/ui';
import { motion, useReducedMotion } from 'motion/react';
import Link from 'next/link';
import type { Pack } from '@/lib/types';

export interface ShelfItem {
  slug: string;
  name: string;
  size: string;
  price: string;
  pack: Pack;
}

// Relative pack heights so a jar, a tin and a carton look like they share one shelf.
const HEIGHT: Record<string, number> = { jar: 0.78, tin: 0.9, tetra: 1, can: 0.72, box: 0.62, pouch: 0.82 };

/**
 * Fallback for the hero until the owner uploads a photo: real products standing on two wooden shelves,
 * each with a kirana-style price tag. Packs drop onto the board one by one.
 */
export function Shelf({ items }: { items: ShelfItem[] }) {
  const reduce = useReducedMotion();
  const rows = [items.slice(0, 3), items.slice(3, 6)].filter((r) => r.length);
  return (
    <div className="relative bg-paper-2 px-5 pb-6 pt-8 md:px-10" aria-label="Some of our products">
      {rows.map((row, r) => (
        <div key={r} className={r ? 'mt-10' : ''}>
          <div className="grid grid-cols-3 items-end gap-4 px-2">
            {row.map((p, i) => {
              const delay = 0.25 + (r * 3 + i) * 0.09;
              return (
                <Link key={p.slug} href={`/p/${p.slug}`} className="group flex h-[180px] items-end justify-center md:h-[220px]">
                  <motion.div
                    initial={reduce ? false : { y: -60, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 17, delay }}
                    style={{ height: `${(HEIGHT[p.pack.kind] ?? 0.8) * 100}%` }}
                    className="origin-bottom transition-transform duration-[var(--dur-2)] group-hover:-translate-y-1.5"
                  >
                    <PackShot kind={p.pack.kind} color={p.pack.color} accent={p.pack.accent} label={p.name} size={p.size} className="h-full w-auto" />
                  </motion.div>
                </Link>
              );
            })}
          </div>
          {/* the board */}
          <div className="relative h-3 bg-[#b88a57] shadow-[0_6px_0_#8e6438,0_14px_18px_-8px_rgb(60_40_20_/_0.5)]" />
          <div className="grid grid-cols-3 gap-4 px-2">
            {row.map((p, i) => (
              <motion.div
                key={p.slug}
                initial={reduce ? false : { rotate: -8, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 120, damping: 7, delay: 0.7 + (r * 3 + i) * 0.09 }}
                style={{ transformOrigin: '50% 0' }}
                className="mx-auto mt-3 w-fit min-w-[84px] border border-ink/70 bg-paper px-2.5 py-1.5 text-center"
              >
                <p className="label truncate text-ink-2">{p.size}</p>
                <p className="num text-[15px]">{p.price}</p>
              </motion.div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
