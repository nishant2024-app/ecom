import Link from 'next/link';
import { ProductCard } from '@/components/ProductCard';
import { Reveal } from '@/components/Reveal';
import { apiGet } from '@/lib/api-server';
import type { Category, ProductSummary } from '@/lib/types';

import type { Metadata } from 'next';

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ category?: string; q?: string }> }): Promise<Metadata> {
  const { category, q } = await searchParams;
  const categories = await apiGet<{ data: Category[] }>('/v1/store/categories', { revalidate: 300 });
  const current = categories?.data.find((c) => c.slug === category);
  if (q) return { title: `Search: ${q}`, robots: { index: false, follow: true } };
  return {
    title: current ? `${current.name}: buy online` : 'Shop all products',
    description: current ? `${current.blurb} Shipped across India from our farm in Mulshi.` : 'Ghee, milk powder, UHT and flavoured milk, condensed milk and mithai. Shipped across India.',
    alternates: { canonical: current ? `/products?category=${current.slug}` : '/products' },
  };
}

export default async function Products({ searchParams }: { searchParams: Promise<{ category?: string; q?: string; sort?: string }> }) {
  const { category, q, sort } = await searchParams;
  const qs = new URLSearchParams({ ...(category ? { category } : {}), ...(q ? { q } : {}), ...(sort ? { sort } : {}) });
  const [products, categories] = await Promise.all([
    apiGet<{ data: ProductSummary[] }>(`/v1/store/products?${qs}`, { revalidate: 30 }),
    apiGet<{ data: Category[] }>('/v1/store/categories', { revalidate: 300 }),
  ]);
  const list = products?.data ?? [];
  const current = categories?.data.find((c) => c.slug === category);
  const chip = (active: boolean) => `whitespace-nowrap py-1 text-[17px] ${active ? 'text-ink underline decoration-2 underline-offset-[7px]' : 'text-ink-2 hover:text-ink'}`;

  return (
    <div className="mx-auto max-w-[1320px] px-4 pb-10 pt-10 md:px-8">
      <div className="grid gap-6 border-b border-ink pb-8 lg:grid-cols-12 lg:items-end">
        <div className="lg:col-span-7">
        <h1 className="font-display text-[clamp(40px,5.4vw,76px)] leading-[0.98]">{q ? `“${q}”` : (current?.name ?? 'Everything we make')}</h1>
        <p className="mt-3 max-w-xl font-serif text-xl italic text-ink-2">{q ? `${list.length} result${list.length === 1 ? '' : 's'}` : (current?.blurb ?? `${list.length} products, all shelf-stable, all shipped across India.`)}</p>
        </div>
        <form action="/products" role="search" className="flex border border-ink bg-paper lg:col-span-5">
          {category && <input type="hidden" name="category" value={category} />}
          <label htmlFor="q" className="sr-only">
            Search products
          </label>
          <input id="q" name="q" defaultValue={q} placeholder="Search: ghee, doodh powder, peda…" className="h-12 w-full bg-transparent px-4 text-base outline-none placeholder:text-ink-3" />
          <button className="h-12 bg-forest px-6 text-on-forest">Search</button>
        </form>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Categories" className="flex gap-6 overflow-x-auto pb-1">
          <Link href="/products" aria-current={!category ? 'page' : undefined} className={chip(!category)}>
            All
          </Link>
          {categories?.data.map((c) => (
            <Link key={c.slug} href={`/products?category=${c.slug}`} aria-current={category === c.slug ? 'page' : undefined} className={chip(category === c.slug)}>
              {c.name}
            </Link>
          ))}
        </nav>
        <nav aria-label="Sort" className="flex gap-1 text-sm">
          {[
            ['', 'Featured'],
            ['price_asc', 'Price ↑'],
            ['price_desc', 'Price ↓'],
          ].map(([v, l]) => (
            <Link key={v} href={`/products?${new URLSearchParams({ ...(category ? { category } : {}), ...(q ? { q } : {}), ...(v ? { sort: v } : {}) })}`} className={`px-2 py-1 ${(sort ?? '') === v ? 'text-ink underline underline-offset-4' : 'text-ink-2 hover:text-ink'}`}>
              {l}
            </Link>
          ))}
        </nav>
      </div>

      {list.length === 0 ? (
        <p className="mt-16 max-w-md text-lg text-ink-2">
          Nothing matches that. Try “ghee”, “powder” or “peda”, or{' '}
          <Link href="/products" className="text-ink underline underline-offset-4">
            see everything
          </Link>
          .
        </p>
      ) : (
        <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-12 md:gap-x-6 lg:grid-cols-4">
          {list.map((p, i) => (
            <Reveal key={p.id} delay={(i % 4) * 0.05}>
              <ProductCard product={p} priority={i < 4} sizes="(min-width: 1024px) 25vw, 50vw" />
            </Reveal>
          ))}
        </div>
      )}
    </div>
  );
}
