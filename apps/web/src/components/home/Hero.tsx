'use client';

import { PackShot } from '@dairy/ui';
import { motion, useReducedMotion } from 'motion/react';
import Link from 'next/link';
import type { Pack, StoreContent } from '@/lib/types';
import { ArrowIcon } from '../icons';
import { Photo } from '../ProductImage';

export interface HeroPack {
  slug: string;
  name: string;
  size: string;
  pack: Pack;
}

const ease = [0.2, 0.7, 0.1, 1] as const;

/** Main banner. With an uploaded photo, the photo fills the banner; otherwise real products stand on the right. */
export function Hero({ content, packs }: { content: StoreContent; packs: HeroPack[] }) {
  const reduce = useReducedMotion();
  const { hero } = content;
  const img = content.images.hero;
  return (
    <section className="mx-auto max-w-[1280px] px-4 pt-4 md:px-6 md:pt-6">
      <div className={`relative overflow-hidden rounded-5 ${img ? 'bg-ink' : 'bg-[linear-gradient(120deg,var(--meadow)_0%,var(--paper-2)_55%,var(--paper)_100%)]'} md:min-h-[460px]`}>
        {img && (
          <>
            <motion.div className="absolute inset-0" initial={reduce ? false : { scale: 1.08 }} animate={{ scale: 1 }} transition={{ duration: 1.4, ease }}>
              <Photo img={img} sizes="(min-width: 1280px) 1280px, 100vw" priority className="h-full w-full object-cover" />
            </motion.div>
            <div className="absolute inset-0 bg-gradient-to-r from-[#000000a6] via-[#00000059] to-transparent" />
          </>
        )}
        <div className={`relative grid h-full grid-cols-1 items-center gap-6 p-6 md:grid-cols-2 md:p-12 ${img ? 'text-[#fff]' : ''}`}>
          <div className="min-w-0 max-w-[540px]">
            {hero.eyebrow && (
              <motion.p initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className={`inline-flex items-center gap-2 rounded-pill px-3 py-1 text-[13px] font-semibold ${img ? 'bg-[#ffffff26] backdrop-blur' : 'bg-paper text-forest shadow-card'}`}>
                <span className="h-1.5 w-1.5 rounded-pill bg-current" aria-hidden />
                {hero.eyebrow}
              </motion.p>
            )}
            <motion.h1 initial={reduce ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.08, ease }} className="mt-4 text-[clamp(30px,5vw,58px)] font-extrabold leading-[1.04] tracking-[-0.035em]">
              {hero.title}
            </motion.h1>
            <motion.p initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.18, ease }} className={`mt-3 text-[15px] leading-relaxed md:mt-4 md:text-lg ${img ? 'text-[#ffffffd9]' : 'text-ink-2'}`}>
              {hero.subtitle}
            </motion.p>
            <motion.div initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.28 }} className="mt-6 flex flex-wrap gap-3 md:mt-7">
              <Link href="/products" className="group inline-flex h-12 items-center gap-2 rounded-pill bg-forest px-6 font-semibold text-on-forest hover:bg-forest-2">
                {hero.ctaLabel}
                <span className="transition-transform group-hover:translate-x-0.5"><ArrowIcon /></span>
              </Link>
            </motion.div>
          </div>
          {!img && packs.length > 0 && (
            <div className="relative flex h-[150px] min-w-0 items-end justify-center gap-2 overflow-hidden px-2 sm:h-[240px] md:h-[340px] md:gap-5">
              <div className="absolute bottom-0 left-1/2 h-10 w-[85%] -translate-x-1/2 rounded-[50%] bg-forest/10 blur-md" aria-hidden />
              {packs.slice(0, 3).map((p, i) => (
                <motion.div
                  key={p.slug}
                  initial={reduce ? false : { y: 50, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 18, delay: 0.2 + i * 0.1 }}
                  className={`flex min-w-0 max-w-[32%] items-end justify-center ${i === 1 ? 'z-10 h-full' : 'h-[76%]'}`}
                >
                  <Link href={`/p/${p.slug}`} aria-label={p.name} className="flex h-full max-w-full items-end transition-transform duration-300 hover:-translate-y-2">
                    <PackShot kind={p.pack.kind} color={p.pack.color} accent={p.pack.accent} label={p.name} size={p.size} className="h-full w-auto max-w-full object-contain drop-shadow-[0_18px_18px_rgba(16,26,20,0.18)]" />
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
