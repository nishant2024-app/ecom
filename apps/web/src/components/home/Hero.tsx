'use client';

import { motion, useReducedMotion } from 'motion/react';
import Link from 'next/link';
import type { StoreContent } from '@/lib/types';
import { Photo } from '../ProductImage';
import { Shelf, type ShelfItem } from './Shelf';

const ease = [0.2, 0.7, 0.1, 1] as const;

export function Hero({ content, shelf }: { content: StoreContent; shelf: ShelfItem[] }) {
  const reduce = useReducedMotion();
  const { hero } = content;
  const img = content.images.hero;
  const words = hero.title.split(' ');
  return (
    <section className="mx-auto grid max-w-[1320px] gap-x-10 gap-y-12 px-4 pb-16 pt-10 md:px-8 lg:grid-cols-12 lg:pt-16">
      <div className="flex flex-col lg:col-span-6 lg:pt-6">
        {hero.eyebrow && (
          <motion.p initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }} className="label text-ink-2">
            {hero.eyebrow}
          </motion.p>
        )}
        <h1 className="mt-5 font-display text-[clamp(42px,6.4vw,92px)] leading-[0.98] tracking-[-0.02em]">
          {words.map((w, i) => (
            <span key={i} className="inline-block overflow-hidden pb-[0.08em] align-bottom">
              <motion.span className="inline-block" initial={reduce ? false : { y: '105%' }} animate={{ y: 0 }} transition={{ duration: 0.8, delay: 0.05 * i, ease }}>
                {w}
                {i < words.length - 1 ? ' ' : ''}
              </motion.span>
            </span>
          ))}
        </h1>
        <motion.p initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.35, ease }} className="mt-7 max-w-[34rem] font-serif text-[21px] leading-[1.45] text-ink-2">
          {hero.subtitle}
        </motion.p>
        <motion.div initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.5 }} className="mt-9 flex flex-wrap items-center gap-x-7 gap-y-4">
          <Link href="/products" className="group inline-flex h-[52px] items-center gap-3 bg-forest px-7 text-[17px] text-on-forest hover:bg-forest-2">
            {hero.ctaLabel}
            <span aria-hidden className="transition-transform duration-[var(--dur-2)] group-hover:translate-x-1">→</span>
          </Link>
          <Link href="/#story" className="text-[17px] underline decoration-1 underline-offset-[6px] hover:decoration-2">
            How we make it
          </Link>
        </motion.div>
      </div>
      <div className="lg:col-span-6">
        {img ? (
          <figure>
            <motion.div
              initial={reduce ? false : { clipPath: 'inset(100% 0 0 0)' }}
              animate={{ clipPath: 'inset(0% 0 0 0)' }}
              transition={{ duration: 1.1, ease: [0.65, 0, 0.35, 1] }}
              className="aspect-[4/5] overflow-hidden bg-paper-2 lg:aspect-[5/6]"
            >
              <motion.div className="h-full w-full" initial={reduce ? false : { scale: 1.12 }} animate={{ scale: 1 }} transition={{ duration: 1.6, ease }}>
                <Photo img={img} sizes="(min-width: 1024px) 50vw, 100vw" priority className="h-full w-full object-cover" />
              </motion.div>
            </motion.div>
            {img.alt && <figcaption className="mt-3 font-serif text-[15px] italic text-ink-2">{img.alt}</figcaption>}
          </figure>
        ) : (
          <Shelf items={shelf} />
        )}
      </div>
    </section>
  );
}
