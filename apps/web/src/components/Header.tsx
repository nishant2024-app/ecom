'use client';

import { motion, useMotionValueEvent, useScroll } from 'motion/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useCart } from '@/lib/cart';

const nav = [
  { href: '/products?category=ghee', label: 'Ghee' },
  { href: '/products?category=milk-powder', label: 'Milk powder' },
  { href: '/products?category=uht-flavoured', label: 'UHT & flavoured' },
  { href: '/products?category=condensed-sweets', label: 'Mithai' },
];

export function Header() {
  const { count, setOpen, bump } = useCart();
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  useMotionValueEvent(scrollY, 'change', (y) => setScrolled(y > 24));

  return (
    <header className="sticky top-0 z-40 px-3 pt-3 md:px-6">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:rounded-2 focus:bg-paper focus:p-2">
        Skip to content
      </a>
      <motion.div
        animate={{ boxShadow: scrolled ? '0 12px 30px -18px rgba(20,39,31,.45)' : '0 0 0 rgba(0,0,0,0)' }}
        className={`mx-auto flex max-w-[1240px] items-center justify-between gap-4 rounded-pill border px-4 py-2.5 backdrop-blur transition-colors duration-[var(--dur-2)] md:px-6 ${scrolled ? 'border-rule bg-paper/90' : 'border-transparent bg-paper/60'}`}
      >
        <Link href="/" className="flex items-center gap-2" aria-label="Mulshi Dairy home">
          <Logo />
          <span className="whitespace-nowrap font-display text-lg leading-none tracking-tight sm:text-xl">Mulshi Dairy</span>
        </Link>
        <nav aria-label="Categories" className="hidden items-center gap-1 lg:flex">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className="rounded-pill px-3 py-1.5 text-base hover:bg-paper-2">
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-1">
          <Link href="/products" aria-label="Search products" className={`grid h-10 w-10 place-items-center rounded-pill hover:bg-paper-2 ${pathname === '/products' ? 'bg-paper-2' : ''}`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" strokeLinecap="round" />
            </svg>
          </Link>
          <Link href="/account" aria-label="My account" className="grid h-10 w-10 place-items-center rounded-pill hover:bg-paper-2">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" strokeLinecap="round" />
            </svg>
          </Link>
          <button
            type="button"
            id="cart-button"
            onClick={() => setOpen(true)}
            className="relative flex h-10 items-center gap-2 rounded-pill bg-forest px-4 text-on-forest hover:bg-forest-2"
            aria-label={`Cart, ${count} item${count === 1 ? '' : 's'}`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
              <path d="M5 8h14l-1.2 11.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8L5 8Z" />
              <path d="M9 8V6a3 3 0 0 1 6 0v2" />
            </svg>
            <motion.span key={bump} initial={{ scale: bump ? 1.6 : 1 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 14 }} className="num text-sm">
              {count}
            </motion.span>
          </button>
        </div>
      </motion.div>
    </header>
  );
}

export function Logo({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden>
      <circle cx="20" cy="20" r="20" fill="var(--forest)" />
      <path d="M11 27V14l9 9 9-9v13" fill="none" stroke="var(--signal)" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="20" cy="10" r="2.4" fill="var(--on-forest)" />
    </svg>
  );
}
