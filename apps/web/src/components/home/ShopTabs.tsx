'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import type { Category, ProductSummary } from '@/lib/types';
import { ProductCard } from '../ProductCard';

/** All products with category tabs, so nothing is repeated and rows never have gaps. */
export function ShopTabs({ products, categories }: { products: ProductSummary[]; categories: Category[] }) {
  const [tab, setTab] = useState('');
  const list = tab ? products.filter((p) => p.category.slug === tab) : products;
  const tabs = [{ slug: '', name: 'All' }, ...categories];
  return (
    <div>
      <div role="tablist" aria-label="Filter by category" className="-mx-4 flex gap-2 no-scrollbar overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
        {tabs.map((c) => (
          <button
            key={c.slug}
            role="tab"
            type="button"
            aria-selected={tab === c.slug}
            onClick={() => setTab(c.slug)}
            className={`relative whitespace-nowrap rounded-pill px-4 py-2 text-[14px] font-semibold transition-colors ${tab === c.slug ? 'text-on-forest' : 'bg-paper-2 text-ink-2 hover:text-ink'}`}
          >
            {tab === c.slug && <motion.span layoutId="shop-tab" className="absolute inset-0 rounded-pill bg-forest" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
            <span className="relative">{c.name}</span>
          </button>
        ))}
      </div>
      <motion.div layout className="mt-5 grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4 xl:grid-cols-5">
        <AnimatePresence mode="popLayout">
          {list.map((p) => (
            <motion.div key={p.id} layout initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} transition={{ duration: 0.25 }}>
              <ProductCard product={p} />
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
