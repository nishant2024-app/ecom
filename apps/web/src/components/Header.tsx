'use client';

import { motion } from 'motion/react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { useCart } from '@/lib/cart';
import { BagIcon, GridIcon, HomeIcon, PinIcon, ReceiptIcon, SearchIcon, UserIcon } from './icons';
import { PincodeSheet } from './PincodeSheet';

const rupees = (p: number) => `₹${(p / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

function SearchBox({ className = '' }: { className?: string }) {
  const params = useSearchParams();
  const router = useRouter();
  const [q, setQ] = useState(params.get('q') ?? '');
  return (
    <form
      role="search"
      className={`flex h-11 items-center gap-2 rounded-pill border border-rule bg-paper-2 px-4 focus-within:border-forest focus-within:bg-paper ${className}`}
      onSubmit={(e) => {
        e.preventDefault();
        router.push(q.trim() ? `/products?q=${encodeURIComponent(q.trim())}` : '/products');
      }}
    >
      <span className="text-ink-3"><SearchIcon /></span>
      <label htmlFor="site-search" className="sr-only">Search products</label>
      <input id="site-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search ghee, milk powder, peda…" className="h-full w-full bg-transparent text-[15px] outline-none placeholder:text-ink-3" />
    </form>
  );
}

export function Header() {
  const { count, items, setOpen, bump, pincode } = useCart();
  const [pinOpen, setPinOpen] = useState(false);
  const subtotal = items.reduce((n, i) => n + i.pricePaise * i.quantity, 0);

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-rule bg-paper/95 backdrop-blur">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:rounded-2 focus:bg-paper focus:p-2">Skip to content</a>
        <div className="mx-auto flex max-w-[1280px] items-center gap-3 px-4 py-3 md:gap-6 md:px-6">
          <Link href="/" className="flex shrink-0 items-center gap-2" aria-label="Mulshi Dairy home">
            <Logo />
            <span className="text-[19px] font-extrabold tracking-[-0.03em]">Mulshi Dairy</span>
          </Link>
          <Suspense fallback={<div className="hidden h-11 flex-1 md:block" />}>
            <SearchBox className="hidden max-w-[560px] flex-1 md:flex" />
          </Suspense>
          <div className="ml-auto flex items-center gap-1 md:gap-2">
            <button type="button" onClick={() => setPinOpen(true)} className="flex items-center gap-2 rounded-pill px-2 py-1.5 text-left hover:bg-paper-2 md:px-3" aria-label={pincode ? `Delivering to ${pincode}. Change pincode` : 'Enter delivery pincode'}>
              <span className="text-forest"><PinIcon /></span>
              <span className="hidden leading-tight lg:block">
                <span className="block text-[11px] text-ink-3">Deliver to</span>
                <span className="num block text-[13px] font-semibold">{pincode || 'Enter pincode'}</span>
              </span>
            </button>
            <Link href="/account" className="hidden items-center gap-2 rounded-pill px-3 py-2 text-[15px] font-medium hover:bg-paper-2 md:flex">
              <UserIcon /> Account
            </Link>
            <Link href="/account" className="grid h-10 w-10 place-items-center rounded-pill hover:bg-paper-2 md:hidden" aria-label="Account"><UserIcon /></Link>
            <button type="button" id="cart-button" onClick={() => setOpen(true)} aria-label={`Cart, ${count} item${count === 1 ? '' : 's'}`} className="relative flex h-11 items-center gap-2 rounded-pill bg-forest pl-3 pr-4 text-on-forest hover:bg-forest-2">
              <BagIcon />
              <motion.span key={bump} initial={{ scale: bump ? 1.35 : 1 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 15 }} className="text-[15px] font-semibold">
                {count ? <span className="num">{count} · {rupees(subtotal)}</span> : 'Cart'}
              </motion.span>
            </button>
          </div>
        </div>
        <div className="px-4 pb-3 md:hidden">
          <Suspense fallback={<div className="h-11" />}>
            <SearchBox />
          </Suspense>
        </div>
      </header>
      <BottomNav count={count} subtotal={subtotal} onCart={() => setOpen(true)} />
      <PincodeSheet open={pinOpen} onClose={() => setPinOpen(false)} />
    </>
  );
}

/** Mobile tab bar plus a "view cart" bar when the cart has items. */
function BottomNav({ count, subtotal, onCart }: { count: number; subtotal: number; onCart: () => void }) {
  const pathname = usePathname();
  const tabs = [
    { href: '/', label: 'Home', icon: <HomeIcon />, active: pathname === '/' },
    { href: '/products', label: 'Shop', icon: <GridIcon />, active: pathname.startsWith('/products') || pathname.startsWith('/p/') },
    { href: '/account', label: 'Orders', icon: <ReceiptIcon />, active: pathname.startsWith('/account') || pathname.startsWith('/orders') },
  ];
  if (pathname.startsWith('/checkout')) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 md:hidden">
      {count > 0 && (
        <motion.button initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} type="button" onClick={onCart} className="mx-3 mb-2 flex w-[calc(100%-24px)] items-center justify-between rounded-4 bg-forest px-4 py-3 text-on-forest shadow-float">
          <span className="text-left leading-tight">
            <span className="num block text-[13px] opacity-90">{count} item{count === 1 ? '' : 's'}</span>
            <span className="num block font-bold">{rupees(subtotal)}</span>
          </span>
          <span className="font-semibold">View cart →</span>
        </motion.button>
      )}
      <nav aria-label="Main" className="grid grid-cols-4 border-t border-rule bg-paper pb-[env(safe-area-inset-bottom)]">
        {tabs.map((t) => (
          <Link key={t.label} href={t.href} aria-current={t.active ? 'page' : undefined} className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${t.active ? 'text-forest' : 'text-ink-2'}`}>
            {t.icon}
            {t.label}
          </Link>
        ))}
        <button type="button" onClick={onCart} className="relative flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium text-ink-2">
          <BagIcon />
          Cart
          {count > 0 && <span className="num absolute right-[28%] top-1 grid h-4 min-w-4 place-items-center rounded-pill bg-forest px-1 text-[10px] text-on-forest">{count}</span>}
        </button>
      </nav>
    </div>
  );
}

/** Milk-drop mark. */
export function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden>
      <rect width="40" height="40" rx="12" fill="var(--forest)" />
      <path d="M20 8c4.5 6 8 10.3 8 14.5a8 8 0 0 1-16 0C12 18.3 15.5 14 20 8Z" fill="#fff" />
      <path d="M16.5 23.5a3.5 3.5 0 0 0 3.5 3.5" fill="none" stroke="var(--forest)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
