'use client';

import { animate, motion, useInView, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';

function Counter({ to, suffix = '' }: { to: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  const reduce = useReducedMotion();
  const [value, setValue] = useState(reduce ? to : 0);
  useEffect(() => {
    if (!inView || reduce) return;
    const controls = animate(0, to, { duration: 1.4, ease: [0.2, 0.7, 0.1, 1], onUpdate: (v) => setValue(Math.round(v)) });
    return () => controls.stop();
  }, [inView, to, reduce]);
  return (
    <span ref={ref} className="num">
      {value}
      {suffix}
    </span>
  );
}

const STATS = [
  { to: 270, suffix: ' days', label: 'Bilona ghee keeps, sealed, at room temperature' },
  { to: 365, suffix: ' days', label: 'Milk powder stays good in its nitrogen-flushed tin' },
  { to: 180, suffix: ' days', label: 'UHT milk lasts unopened, no fridge needed' },
  { to: 6, suffix: ' days', label: 'At most to reach most Indian pincodes' },
];

export function Stats() {
  return (
    <div className="grid gap-px overflow-hidden rounded-4 bg-rule sm:grid-cols-2 lg:grid-cols-4">
      {STATS.map((s, i) => (
        <motion.div key={s.label} initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} className="bg-paper p-6">
          <p className="text-[clamp(36px,4vw,52px)] leading-none text-forest">
            <Counter to={s.to} suffix={s.suffix} />
          </p>
          <p className="mt-3 text-base text-ink-2">{s.label}</p>
        </motion.div>
      ))}
    </div>
  );
}
