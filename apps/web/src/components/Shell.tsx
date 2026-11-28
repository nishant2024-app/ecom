'use client';

import { MotionConfig } from 'motion/react';
import type { ReactNode } from 'react';
import { CartProvider } from '@/lib/cart';
import { CartDrawer } from './CartDrawer';
import { FlyToCart } from './FlyToCart';
import { Header } from './Header';

export function Shell({ children }: { children: ReactNode }) {
  return (
    // In production animations follow the visitor's device setting; in development the notice about it is silenced.
    <MotionConfig reducedMotion={process.env.NODE_ENV === 'production' ? 'user' : 'never'}>
      <CartProvider>
        <Header />
        {children}
        <CartDrawer />
        <FlyToCart />
      </CartProvider>
    </MotionConfig>
  );
}
