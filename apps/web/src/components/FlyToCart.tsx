'use client';

import { PackShot } from '@dairy/ui';
import { AnimatePresence, motion } from 'motion/react';
import { useCart } from '@/lib/cart';

/** The pack you added arcs from the button into the cart. */
export function FlyToCart() {
  const { flights, landed } = useCart();
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[60]">
      <AnimatePresence>
        {flights.map((f) => {
          const target = document.getElementById('cart-button')?.getBoundingClientRect();
          const tx = target ? target.left + target.width / 2 - 30 : window.innerWidth - 60;
          const ty = target ? target.top + target.height / 2 - 40 : 20;
          const sx = f.from.left + f.from.width / 2 - 30;
          const sy = f.from.top + f.from.height / 2 - 40;
          return (
            <motion.div
              key={f.id}
              className="absolute left-0 top-0 h-20 w-[60px]"
              initial={{ x: sx, y: sy, scale: 1, rotate: 0, opacity: 1 }}
              animate={{ x: [sx, (sx + tx) / 2, tx], y: [sy, Math.min(sy, ty) - 120, ty], scale: [1, 1.15, 0.35], rotate: [0, -14, 8], opacity: [1, 1, 0.6] }}
              transition={{ duration: 0.75, ease: [0.3, 0, 0.2, 1] }}
              onAnimationComplete={() => landed(f.id)}
            >
              <PackShot kind={f.pack.kind} color={f.pack.color} accent={f.pack.accent} label={f.name} className="h-full w-full drop-shadow-lg" />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
