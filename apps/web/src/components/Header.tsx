'use client';

import { motion, useMotionValueEvent, useScroll } from 'motion/react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { useCart } from '@/lib/cart';

const nav = [
  { slug: 'ghee', label: 'Ghee' },
  { slug: 'milk-powder', label: 'Milk powder' },
  { slug: 'uht-flavoured', label: 'UHT & flavoured' },
  { slug: 'condensed-sweets', label: 'Mithai' },
];

function NavLinks({ className, item }: { className: string; item: string }) {
  const pathname = usePathname();
  const params = useSearchParams();
  return (
    <nav aria-label="Categories" className={className}>
      {nav.map((n) => {
        const active = pathname === '/products' && params.get('category') === n.slug;
        return (
          <Link key={n.slug} href={`/products?category=${n.slug}`} aria-current={active ? 'page' : undefined} className={`${item} ${active ? 'text-ink underline decoration-2 underline-offset-[6px]' : 'text-ink-2 hover:text-ink'}`}>
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function Header() {
  const { count, setOpen, bump } = useCart();
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  useMotionValueEvent(scrollY, 'change', (y) => setScrolled(y > 40));

  return (
    <header className={`sticky top-0 z-40 bg-paper/95 backdrop-blur-sm transition-[border-color] duration-[var(--dur-2)] ${scrolled ? 'border-b border-rule' : 'border-b border-transparent'}`}>
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:bg-paper focus:p-2">
        Skip to content
      </a>
      <div className={`mx-auto grid max-w-[1320px] grid-cols-[1fr_auto] items-center gap-4 px-4 transition-[padding] duration-[var(--dur-2)] md:px-8 lg:grid-cols-[1fr_auto_1fr] ${scrolled ? 'py-2.5' : 'py-4'}`}>
        <Link href="/" className="flex items-center gap-2.5 justify-self-start" aria-label="Mulshi Dairy home">
          <Logo />
          <span className="font-display text-[22px] leading-none tracking-[-0.01em]">Mulshi Dairy</span>
        </Link>
        <Suspense fallback={null}>
          <NavLinks className="hidden items-center gap-7 lg:flex" item="text-[15px]" />
        </Suspense>
        <div className="flex items-center gap-1 justify-self-end text-[15px]">
          <Link href="/products" className="hidden px-2 py-1.5 text-ink-2 hover:text-ink sm:block">
            Search
          </Link>
          <Link href="/account" className="px-2 py-1.5 text-ink-2 hover:text-ink">
            Account
          </Link>
          <button type="button" id="cart-button" onClick={() => setOpen(true)} className="ml-1 flex items-center gap-2 border border-ink px-3 py-1.5 hover:bg-ink hover:text-paper" aria-label={`Basket, ${count} item${count === 1 ? '' : 's'}`}>
            Basket
            <motion.span key={bump} initial={{ y: bump ? -8 : 0, opacity: bump ? 0 : 1 }} animate={{ y: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 22 }} className="num min-w-[1ch] text-sm">
              {count}
            </motion.span>
          </button>
        </div>
      </div>
      <Suspense fallback={null}>
        <NavLinks className="flex gap-5 overflow-x-auto px-4 pb-2.5 lg:hidden" item="whitespace-nowrap text-sm" />
      </Suspense>
    </header>
  );
}

/** Wordmark seal: a churn handle inside a ring. */
export function Logo({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden>
      <circle cx="20" cy="20" r="18.5" fill="none" stroke="var(--forest)" strokeWidth="2" />
      <circle cx="20" cy="20" r="14" fill="var(--forest)" />
      <path d="M20 8v17" stroke="var(--signal)" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M13.5 22.5c2 3.6 11 3.6 13 0" fill="none" stroke="var(--on-forest)" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M15 17h10" stroke="var(--signal)" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}
