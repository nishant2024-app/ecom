'use client';

import type { ReactNode } from 'react';
import { CartProvider } from '@/lib/cart';
import { CartDrawer } from './CartDrawer';
import { FlyToCart } from './FlyToCart';
import { Header } from './Header';

export function Shell({ children }: { children: ReactNode }) {
  return (
    <CartProvider>
      <Header />
      {children}
      <CartDrawer />
      <FlyToCart />
    </CartProvider>
  );
}
