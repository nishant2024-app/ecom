'use client';

import { PackShot } from '@dairy/ui';
import { motion, useReducedMotion } from 'motion/react';
import Link from 'next/link';
import type { Category } from '@/lib/types';

/** Category index set like a contents page: big names, a line of description, the packs that live there. */
export function Shelves({ categories }: { categories: Category[] }) {
  const reduce = useReducedMotion();
  return (
    <ol className="border-t border-ink">
      {categories.map((c, i) => (
        <li key={c.slug} className="border-b border-rule">
          <Link href={`/products?category=${c.slug}`} className="group grid grid-cols-[2.5rem_1fr_auto] items-center gap-4 py-6 md:grid-cols-[3.5rem_minmax(0,1.1fr)_minmax(0,1fr)_auto] md:py-8">
            <span className="num self-start pt-2 text-sm text-ink-3">{String(i + 1).padStart(2, '0')}</span>
            <span className="font-display text-[clamp(30px,4.4vw,58px)] leading-none transition-transform duration-[var(--dur-3)] ease-[var(--ease)] group-hover:translate-x-2">{c.name}</span>
            <span className="hidden text-[17px] text-ink-2 md:block">{c.blurb}</span>
            <span className="flex items-end gap-1.5">
              {c.packs.slice(0, 3).map((p, j) => (
                <motion.span
                  key={j}
                  className="block h-14 md:h-20"
                  initial={false}
                  whileInView={reduce ? undefined : { y: [12, 0], opacity: [0, 1] }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.08 * j, duration: 0.5 }}
                >
                  <PackShot kind={p.kind} color={p.color} accent={p.accent} label="" className="h-full w-auto" />
                </motion.span>
              ))}
              <span className="num ml-3 hidden text-sm text-ink-2 sm:inline">{c.productCount} →</span>
            </span>
          </Link>
        </li>
      ))}
    </ol>
  );
}
