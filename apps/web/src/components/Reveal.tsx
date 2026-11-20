'use client';

import { motion, useReducedMotion, type HTMLMotionProps } from 'motion/react';

/** Fades and lifts children into place the first time they scroll into view. */
export function Reveal({ delay = 0, y = 24, ...props }: HTMLMotionProps<'div'> & { delay?: number; y?: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.6, delay, ease: [0.2, 0.7, 0.1, 1] }}
      {...props}
    />
  );
}
