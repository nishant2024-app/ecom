'use client';

import { AnimatePresence, motion, useMotionValueEvent, useReducedMotion, useScroll, useTransform } from 'motion/react';
import { useRef, useState } from 'react';

const STEPS = [
  { title: 'Graze', body: 'Our Gir cows and buffaloes graze the hill pastures of Mulshi. Milking starts at 4 AM.', icon: 'sun' },
  { title: 'Churn & cook', body: 'For bilona ghee, curd is hand-churned into butter and slow-cooked over a wood fire until it turns granular.', icon: 'pot' },
  { title: 'Dry or seal', body: 'Milk is spray-dried into powder, or heated to 140 °C for four seconds and sealed in six-layer cartons.', icon: 'carton' },
  { title: 'Test & code', body: 'Each batch is tested for fat and moisture, and the batch code and expiry date are printed on the pack.', icon: 'flask' },
  { title: 'Pack & ship', body: 'Packed in recyclable boxes and handed to the courier, usually the next working day.', icon: 'truck' },
] as const;

function Icon({ name }: { name: (typeof STEPS)[number]['icon'] }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 3, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <svg viewBox="0 0 120 120" className="h-full w-full" aria-hidden>
      {name === 'sun' && (
        <g {...common}>
          <circle cx="60" cy="54" r="18" />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
            <line key={a} x1={60 + Math.cos((a * Math.PI) / 180) * 28} y1={54 + Math.sin((a * Math.PI) / 180) * 28} x2={60 + Math.cos((a * Math.PI) / 180) * 36} y2={54 + Math.sin((a * Math.PI) / 180) * 36} />
          ))}
          <path d="M10 100 C30 84 50 88 60 96 S90 104 110 90" />
          <path d="M20 108 l4 -10 M34 108 l2 -12 M86 108 l-2 -12 M100 108 l-4 -10" />
        </g>
      )}
      {name === 'pot' && (
        <g {...common}>
          <path d="M28 52 h64 l-6 44 a8 8 0 0 1 -8 7 H42 a8 8 0 0 1 -8 -7 Z" />
          <path d="M22 52 h76" />
          <path d="M60 52 V18 M52 26 h16" />
          <path d="M40 112 c4 -6 8 -6 12 0 s8 6 12 0 s8 -6 12 0" />
          <path d="M46 40 c-4 -6 2 -10 -2 -16 M74 40 c-4 -6 2 -10 -2 -16" />
        </g>
      )}
      {name === 'carton' && (
        <g {...common}>
          <path d="M38 34 h44 v74 H38 Z" />
          <path d="M38 34 l8 -14 h28 l8 14" />
          <path d="M82 34 l12 8 v60 l-12 6" />
          <path d="M38 74 c14 -8 30 -8 44 0" />
          <circle cx="66" cy="26" r="3" />
        </g>
      )}
      {name === 'flask' && (
        <g {...common}>
          <path d="M48 18 h24 M52 18 v30 l-22 44 a8 8 0 0 0 7 12 h46 a8 8 0 0 0 7 -12 l-22 -44 V18" />
          <path d="M38 80 h44" />
          <circle cx="54" cy="92" r="3" />
          <circle cx="68" cy="88" r="2" />
        </g>
      )}
      {name === 'truck' && (
        <g {...common}>
          <path d="M10 40 h62 v44 H10 Z" />
          <path d="M72 54 h22 l14 16 v14 H72" />
          <circle cx="30" cy="90" r="9" />
          <circle cx="90" cy="90" r="9" />
          <path d="M22 54 h28 M22 66 h18" />
        </g>
      )}
    </svg>
  );
}

/** Scroll-driven: the panel sticks while you scroll through five steps. */
export function Process() {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] });
  const [active, setActive] = useState(0);
  const line = useTransform(scrollYProgress, [0, 1], [0, 1]);
  useMotionValueEvent(scrollYProgress, 'change', (p) => setActive(Math.min(STEPS.length - 1, Math.floor(p * STEPS.length))));

  return (
    <section id="process" ref={ref} className="relative" style={{ height: reduce ? 'auto' : `${STEPS.length * 45 + 60}vh` }} aria-label="How it's made">
      <div className={`${reduce ? '' : 'sticky top-0 flex h-screen items-center'} px-3 md:px-6`}>
        <div className="mx-auto grid w-full max-w-[1240px] gap-8 rounded-5 bg-paper-2 p-6 md:grid-cols-12 md:p-12">
          <div className="md:col-span-6">
            <p className="text-sm uppercase tracking-[0.14em] text-ink-2">From pasture to pantry</p>
            <h2 className="mt-3 font-display text-[clamp(34px,4.6vw,60px)] leading-[1.02]">How a jar of ghee gets to your door</h2>
            <ol className="relative mt-8 space-y-1 pl-8">
              <span aria-hidden className="absolute left-[11px] top-2 h-[calc(100%-16px)] w-0.5 rounded-pill bg-rule" />
              <motion.span aria-hidden style={{ scaleY: line }} className="absolute left-[11px] top-2 h-[calc(100%-16px)] w-0.5 origin-top rounded-pill bg-forest" />
              {STEPS.map((s, i) => (
                <li key={s.title} className="relative py-2" aria-current={i === active ? 'step' : undefined}>
                  <motion.span aria-hidden animate={{ scale: i === active ? 1.25 : 1, backgroundColor: i <= active ? 'var(--forest)' : 'var(--paper-3)' }} className="absolute -left-8 top-3.5 h-[24px] w-[24px] rounded-pill border-4 border-paper-2" />
                  <p className={`text-xl transition-colors duration-[var(--dur-2)] ${i === active ? 'text-ink' : 'text-ink-3'}`}>
                    <span className="num mr-3 text-sm">0{i + 1}</span>
                    {s.title}
                  </p>
                  <motion.p initial={false} animate={{ height: i === active || reduce ? 'auto' : 0, opacity: i === active || reduce ? 1 : 0 }} className="overflow-hidden text-base text-ink-2">
                    <span className="block pt-1">{s.body}</span>
                  </motion.p>
                </li>
              ))}
            </ol>
          </div>
          <div className="relative grid min-h-[320px] place-items-center md:col-span-5 md:col-start-8">
            <div className="absolute inset-6 rounded-pill bg-meadow" aria-hidden />
            <AnimatePresence mode="wait">
              <motion.div
                key={active}
                initial={{ opacity: 0, scale: 0.85, rotate: -6 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                exit={{ opacity: 0, scale: 0.9, rotate: 6 }}
                transition={{ duration: 0.45, ease: [0.2, 0.7, 0.1, 1] }}
                className="relative h-56 w-56 text-forest md:h-72 md:w-72"
              >
                <Icon name={STEPS[active]!.icon} />
              </motion.div>
            </AnimatePresence>
            <p className="num absolute bottom-6 right-8 text-6xl text-forest/15" aria-hidden>
              0{active + 1}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
