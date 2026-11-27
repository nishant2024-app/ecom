'use client';

import { PackShot } from '@dairy/ui';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Img, Pack, StoreContent } from '@/lib/types';
import { ArrowIcon } from '../icons';
import { Photo } from '../ProductImage';

export interface BannerPack {
  slug: string;
  name: string;
  size: string;
  pack: Pack;
}
type Banner = StoreContent['banners'][number];

const THEMES: Record<Banner['theme'], { bg: string; ink: string; sub: string; chip: string; deco: (id: string) => React.ReactNode }> = {
  ghee: {
    bg: 'linear-gradient(115deg,#fff7e0 0%,#fde7a8 55%,#f4c95d 100%)',
    ink: '#3a2a05',
    sub: '#6b5418',
    chip: 'bg-[#ffffffcc] text-[#7a5a00]',
    deco: (id) => (
      <svg className="absolute inset-x-0 bottom-0 h-[38%] w-full" viewBox="0 0 1200 300" preserveAspectRatio="none" aria-hidden>
        <defs>
          <linearGradient id={`g${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#e9ad2b" />
            <stop offset="1" stopColor="#c98a12" />
          </linearGradient>
        </defs>
        <path d="M0 120 C 180 60 300 170 480 110 S 800 40 960 100 S 1140 150 1200 90 V300 H0Z" fill={`url(#g${id})`} opacity=".55" />
        <path d="M0 180 C 200 130 360 230 560 170 S 900 110 1060 170 S 1170 200 1200 160 V300 H0Z" fill={`url(#g${id})`} />
      </svg>
    ),
  },
  milk: {
    bg: 'linear-gradient(115deg,#f4f9ff 0%,#e3f0fb 55%,#cfe4f6 100%)',
    ink: '#0f2a44',
    sub: '#3d5a78',
    chip: 'bg-[#ffffffcc] text-[#1d5a8a]',
    deco: () => (
      <svg className="absolute inset-x-0 bottom-0 h-[42%] w-full" viewBox="0 0 1200 300" preserveAspectRatio="none" aria-hidden>
        <path d="M0 150 Q 100 90 200 150 T 400 150 T 600 150 T 800 150 T 1000 150 T 1200 150 V300 H0Z" fill="#ffffff" opacity=".6" />
        <path d="M0 200 Q 150 150 300 200 T 600 200 T 900 200 T 1200 200 V300 H0Z" fill="#ffffff" />
        {[180, 420, 760, 1010].map((x, i) => (
          <circle key={x} cx={x} cy={128 - (i % 2) * 18} r={7 + (i % 3) * 3} fill="#ffffff" />
        ))}
      </svg>
    ),
  },
  sweets: {
    bg: 'linear-gradient(115deg,#fff1e8 0%,#f9d7c1 55%,#eab28e 100%)',
    ink: '#3d1a0a',
    sub: '#74412a',
    chip: 'bg-[#ffffffcc] text-[#8a3d16]',
    deco: (id) => (
      <svg className="absolute inset-0 h-full w-full opacity-[.18]" aria-hidden>
        <defs>
          <pattern id={`p${id}`} width="56" height="56" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <circle cx="14" cy="14" r="3.2" fill="#8a3d16" />
            <circle cx="42" cy="42" r="2" fill="#8a3d16" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#p${id})`} />
      </svg>
    ),
  },
  green: {
    bg: 'linear-gradient(115deg,#f1faf3 0%,#dff2e4 55%,#bfe3c9 100%)',
    ink: '#0d2a17',
    sub: '#3b5c46',
    chip: 'bg-[#ffffffcc] text-forest',
    deco: () => (
      <svg className="absolute inset-x-0 bottom-0 h-[40%] w-full" viewBox="0 0 1200 300" preserveAspectRatio="none" aria-hidden>
        <path d="M0 170 C 250 80 500 210 760 140 S 1100 120 1200 150 V300 H0Z" fill="#9fd3ae" />
        <path d="M0 230 C 300 170 600 260 900 210 S 1150 200 1200 220 V300 H0Z" fill="#6fbd86" />
      </svg>
    ),
  },
};

const INTERVAL = 6000;

export function HeroCarousel({ banners, images, packsFor }: { banners: Banner[]; images: (Img | null)[]; packsFor: Record<string, BannerPack[]> }) {
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [dir, setDir] = useState(1);
  const startX = useRef<number | null>(null);
  const count = banners.length;
  const go = useCallback(
    (to: number) => {
      setDir(to > index || (index === count - 1 && to === 0) ? 1 : -1);
      setIndex(((to % count) + count) % count);
    },
    [index, count],
  );

  useEffect(() => {
    if (reduce || paused || count < 2) return;
    const t = setTimeout(() => go(index + 1), INTERVAL);
    return () => clearTimeout(t);
  }, [index, paused, reduce, count, go]);

  if (!count) return null;
  const b = banners[index]!;
  const theme = THEMES[b.theme] ?? THEMES.green;
  const img = images[index] ?? null;
  const packs = (b.categorySlug ? packsFor[b.categorySlug] : undefined) ?? packsFor.__all ?? [];

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Featured"
      className="mx-auto max-w-[1280px] px-4 pt-4 md:px-6 md:pt-6"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div
        className="relative h-[480px] touch-pan-y overflow-hidden rounded-5 sm:h-[440px] md:h-[460px]"
        onPointerDown={(e) => (startX.current = e.clientX)}
        onPointerUp={(e) => {
          if (startX.current === null) return;
          const dx = e.clientX - startX.current;
          startX.current = null;
          if (Math.abs(dx) > 50) go(index + (dx < 0 ? 1 : -1));
        }}
      >
        <AnimatePresence initial={false} custom={dir} mode="popLayout">
          <motion.div
            key={index}
            custom={dir}
            role="group"
            aria-roledescription="slide"
            aria-label={`${index + 1} of ${count}: ${b.title}`}
            initial={reduce ? { opacity: 0 } : { x: `${dir * 100}%` }}
            animate={reduce ? { opacity: 1 } : { x: 0 }}
            exit={reduce ? { opacity: 0 } : { x: `${-dir * 100}%` }}
            transition={{ type: 'tween', duration: 0.6, ease: [0.65, 0, 0.35, 1] }}
            className="absolute inset-0"
            style={{ background: img ? '#101a14' : theme.bg }}
          >
            {img ? (
              <>
                <motion.div className="absolute inset-0" initial={reduce ? false : { scale: 1.08 }} animate={{ scale: 1 }} transition={{ duration: INTERVAL / 1000, ease: 'linear' }}>
                  <Photo img={img} sizes="(min-width: 1280px) 1280px, 100vw" priority={index === 0} className="h-full w-full object-cover" />
                </motion.div>
                <div className="absolute inset-0 bg-gradient-to-r from-[#000000b3] via-[#00000066] to-transparent" />
              </>
            ) : (
              theme.deco(String(index))
            )}
            <div className="relative grid h-full grid-cols-1 content-start gap-4 p-6 pt-8 md:grid-cols-[1.05fr_1fr] md:content-center md:px-20 md:py-12">
              <div className="min-w-0 max-w-[540px]" style={{ color: img ? '#fff' : theme.ink }}>
                {b.eyebrow && (
                  <motion.p
                    initial={reduce ? false : { opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.25 }}
                    className={`inline-flex rounded-pill px-3 py-1 text-[13px] font-bold ${img ? 'bg-[#ffffff26] text-[#fff] backdrop-blur' : theme.chip}`}
                  >
                    {b.eyebrow}
                  </motion.p>
                )}
                <motion.h2
                  initial={reduce ? false : { opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.32, duration: 0.6 }}
                  className="mt-3 text-[clamp(28px,4.6vw,54px)] font-extrabold leading-[1.05] tracking-[-0.035em]"
                >
                  {index === 0 ? <span className="sr-only">Mulshi Dairy: </span> : null}
                  {b.title}
                </motion.h2>
                <motion.p
                  initial={reduce ? false : { opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.42 }}
                  className="mt-3 max-w-[460px] text-[15px] leading-relaxed md:text-[17px]"
                  style={{ color: img ? '#ffffffd9' : theme.sub }}
                >
                  {b.subtitle}
                </motion.p>
                <motion.div initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="mt-6">
                  <Link href={b.href} className="group inline-flex h-12 items-center gap-2 rounded-pill bg-forest px-6 font-semibold text-on-forest shadow-float hover:bg-forest-2">
                    {b.ctaLabel}
                    <span className="transition-transform group-hover:translate-x-0.5">
                      <ArrowIcon />
                    </span>
                  </Link>
                </motion.div>
              </div>
              {!img && packs.length > 0 && (
                <div className="relative flex h-[170px] min-w-0 items-end justify-center gap-3 sm:h-[200px] md:h-[330px] md:gap-6">
                  {packs.slice(0, 3).map((p, i) => (
                    <motion.div
                      key={p.slug}
                      initial={reduce ? false : { y: 70, opacity: 0, rotate: i === 1 ? 0 : i === 0 ? -6 : 6 }}
                      animate={{ y: 0, opacity: 1, rotate: 0 }}
                      transition={{ type: 'spring', stiffness: 170, damping: 16, delay: 0.35 + i * 0.12 }}
                      className={`flex min-w-0 max-w-[32%] items-end ${i === 1 ? 'z-10 h-full' : 'h-[74%]'}`}
                    >
                      <Link href={`/p/${p.slug}`} aria-label={p.name} className="flex h-full max-w-full items-end transition-transform duration-300 hover:-translate-y-2">
                        <PackShot
                          kind={p.pack.kind}
                          color={p.pack.color}
                          accent={p.pack.accent}
                          label={p.name}
                          size={p.size}
                          className="h-full w-auto max-w-full drop-shadow-[0_22px_20px_rgba(40,25,0,0.28)]"
                        />
                      </Link>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </AnimatePresence>

        {count > 1 && (
          <>
            <button
              type="button"
              aria-label="Previous slide"
              onClick={() => go(index - 1)}
              className="absolute left-3 top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-pill bg-[#ffffffd9] text-ink shadow-card hover:bg-[#fff] md:grid"
            >
              <span className="rotate-180">
                <ArrowIcon />
              </span>
            </button>
            <button
              type="button"
              aria-label="Next slide"
              onClick={() => go(index + 1)}
              className="absolute right-3 top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-pill bg-[#ffffffd9] text-ink shadow-card hover:bg-[#fff] md:grid"
            >
              <ArrowIcon />
            </button>
            <div className="absolute bottom-1 left-1/2 z-20 flex -translate-x-1/2" role="tablist" aria-label="Choose slide">
              {banners.map((x, i) => (
                <button
                  key={i}
                  type="button"
                  role="tab"
                  aria-selected={i === index}
                  aria-label={`Slide ${i + 1}: ${x.title}`}
                  onClick={() => go(i)}
                  className="grid h-11 min-w-[28px] place-items-center px-1"
                >
                  <span className="relative block h-2 overflow-hidden rounded-pill bg-[#10201633] transition-all" style={{ width: i === index ? 36 : 8 }}>
                    {i === index && !reduce && !paused && (
                      <motion.span
                        key={`p${index}`}
                        className="absolute inset-y-0 left-0 bg-forest"
                        initial={{ width: 0 }}
                        animate={{ width: '100%' }}
                        transition={{ duration: INTERVAL / 1000, ease: 'linear' }}
                      />
                    )}
                    {i === index && (reduce || paused) && <span className="absolute inset-0 bg-forest" />}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
