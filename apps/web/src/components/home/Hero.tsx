'use client';

import { PackShot } from '@dairy/ui';
import { motion, useMotionValue, useReducedMotion, useScroll, useSpring, useTransform, type MotionValue } from 'motion/react';
import Link from 'next/link';
import { useRef } from 'react';
import type { Pack } from '@/lib/types';

export interface HeroPack {
  slug: string;
  name: string;
  size: string;
  pack: Pack;
}

const WORDS = ['Farm', 'dairy,', 'made', 'to', 'keep.'];

/** Each pack floats on its own rhythm, follows the pointer slightly and drifts apart as you scroll. */
function FloatingPack({ p, i, mx, my, spread, layout }: { p: HeroPack; i: number; mx: MotionValue<number>; my: MotionValue<number>; spread: MotionValue<number>; layout: { x: number; y: number; w: number; r: number; z: number; depth: number } }) {
  const reduce = useReducedMotion();
  const x = useTransform([mx, spread] as MotionValue<number>[], ([m, s]: number[]) => layout.x + m! * layout.depth + (layout.x - 50) * s! * 0.6);
  const y = useTransform([my, spread] as MotionValue<number>[], ([m, s]: number[]) => layout.y + m! * layout.depth - s! * 40 * (i % 2 ? 1 : 0.4));
  const rotate = useTransform(spread, (s) => layout.r + s * (i % 2 ? 12 : -10));
  return (
    <motion.div
      style={{ left: useTransform(x, (v) => `${v}%`), top: useTransform(y, (v) => `${v}%`), rotate, width: `${layout.w}%`, zIndex: layout.z }}
      className="absolute -translate-x-1/2 -translate-y-1/2"
      initial={reduce ? false : { opacity: 0, y: 60, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.9, delay: 0.25 + i * 0.12, ease: [0.2, 0.7, 0.1, 1] }}
    >
      <Link href={`/p/${p.slug}`} aria-label={p.name} className="block">
        <motion.div animate={reduce ? undefined : { y: [0, -12, 0] }} transition={{ duration: 4 + i * 0.7, repeat: Infinity, ease: 'easeInOut', delay: i * 0.4 }} whileHover={{ scale: 1.06, rotate: -3 }}>
          <PackShot kind={p.pack.kind} color={p.pack.color} accent={p.pack.accent} label={p.name} size={p.size} className="w-full drop-shadow-[0_24px_30px_rgba(10,30,20,0.45)]" />
        </motion.div>
      </Link>
    </motion.div>
  );
}

const LAYOUTS = [
  { x: 50, y: 50, w: 38, r: 0, z: 3, depth: 18 },
  { x: 22, y: 42, w: 30, r: -8, z: 2, depth: 10 },
  { x: 78, y: 40, w: 28, r: 7, z: 2, depth: 12 },
  { x: 32, y: 74, w: 26, r: -4, z: 4, depth: 24 },
  { x: 70, y: 74, w: 25, r: 5, z: 4, depth: 22 },
];

export function Hero({ packs }: { packs: HeroPack[] }) {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const spread = useSpring(useTransform(scrollYProgress, [0, 1], [0, 1]), { stiffness: 80, damping: 20 });
  const sunY = useTransform(scrollYProgress, [0, 1], ['0%', '40%']);
  const hillY = useTransform(scrollYProgress, [0, 1], ['0%', '18%']);
  const mxRaw = useMotionValue(0);
  const myRaw = useMotionValue(0);
  const mx = useSpring(mxRaw, { stiffness: 60, damping: 18 });
  const my = useSpring(myRaw, { stiffness: 60, damping: 18 });

  return (
    <section
      ref={ref}
      onPointerMove={(e) => {
        if (reduce) return;
        const r = e.currentTarget.getBoundingClientRect();
        mxRaw.set(((e.clientX - r.left) / r.width - 0.5) * 0.12);
        myRaw.set(((e.clientY - r.top) / r.height - 0.5) * 0.12);
      }}
      className="px-3 pt-3 md:px-6"
    >
      <div className="relative mx-auto max-w-[1240px] overflow-hidden rounded-5 bg-forest text-on-forest">
        {/* sun */}
        <motion.div aria-hidden style={{ y: sunY }} className="absolute right-[8%] top-[6%] hidden h-[46vmin] w-[46vmin] rounded-pill bg-signal/25 blur-[2px] md:block" />
        <motion.div aria-hidden style={{ y: sunY }} className="absolute right-[14%] top-[12%] hidden h-[30vmin] w-[30vmin] rounded-pill bg-signal/35 md:block" />
        {/* hills */}
        <motion.svg aria-hidden style={{ y: hillY }} viewBox="0 0 1240 260" preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 h-[34%] w-full">
          <path d="M0 150 C 180 60, 360 70, 520 130 S 860 210, 1240 90 V260 H0 Z" fill="var(--forest-2)" />
          <path d="M0 210 C 220 140, 420 170, 640 200 S 1000 230, 1240 170 V260 H0 Z" fill="#0f3725" opacity="0.9" />
        </motion.svg>

        <div className="relative grid min-h-[min(760px,92vh)] gap-6 px-6 pb-10 pt-16 md:grid-cols-12 md:px-12 md:pt-20">
          <div className="md:col-span-6 md:self-center">
            <motion.p initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="inline-flex items-center gap-2 rounded-pill border border-on-forest/25 px-3 py-1 text-sm text-on-forest/85">
              <span className="h-2 w-2 rounded-pill bg-signal" aria-hidden />
              From our herd in Mulshi · ships across India
            </motion.p>
            <h1 className="mt-6 font-display text-[clamp(48px,7.4vw,104px)] leading-[0.95] tracking-tight">
              {WORDS.map((w, i) => (
                <span key={w} className="inline-block overflow-hidden pb-2 align-bottom">
                  <motion.span
                    className={`inline-block ${w.startsWith('keep') ? 'text-signal' : ''}`}
                    initial={reduce ? false : { y: '110%' }}
                    animate={{ y: 0 }}
                    transition={{ duration: 0.8, delay: 0.1 + i * 0.08, ease: [0.2, 0.7, 0.1, 1] }}
                  >
                    {w}&nbsp;
                  </motion.span>
                </span>
              ))}
            </h1>
            <motion.p initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="mt-5 max-w-[32rem] text-lg text-on-forest/85">
              Bilona ghee cooked over a wood fire, milk powder dried hours after milking, UHT milk sealed for six months. Real dairy that lives in your pantry, not your fridge.
            </motion.p>
            <motion.div initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.75 }} className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/products" className="group inline-flex h-14 items-center gap-2 rounded-pill bg-signal px-7 text-lg font-medium text-on-signal">
                Shop the pantry
                <motion.span aria-hidden className="inline-block" initial={false} whileHover={{ x: 4 }}>
                  →
                </motion.span>
              </Link>
              <a href="#process" className="inline-flex h-14 items-center rounded-pill border border-on-forest/40 px-6 text-lg hover:bg-on-forest/10">
                How it&rsquo;s made
              </a>
            </motion.div>
            <motion.dl initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }} className="mt-12 grid max-w-[30rem] grid-cols-3 gap-3 border-t border-on-forest/20 pt-5">
              {[
                ['9 months', 'ghee shelf life'],
                ['₹499', 'free shipping, Pune'],
                ['2–6 days', 'anywhere in India'],
              ].map(([v, l]) => (
                <div key={l}>
                  <dt className="sr-only">{l}</dt>
                  <dd className="num whitespace-nowrap text-base text-signal sm:text-xl md:text-2xl">{v}</dd>
                  <dd className="text-sm text-on-forest/75">{l}</dd>
                </div>
              ))}
            </motion.dl>
          </div>
          <div className="relative min-h-[360px] md:col-span-6 md:min-h-[420px]">
            <div aria-hidden className="absolute left-1/2 top-1/2 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-pill bg-signal/25 md:hidden" />
            {packs.slice(0, 5).map((p, i) => (
              <FloatingPack key={p.slug} p={p} i={i} mx={mx} my={my} spread={spread} layout={LAYOUTS[i]!} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
