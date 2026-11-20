import Link from 'next/link';
import { ProductCard } from '@/components/ProductCard';
import { Reveal } from '@/components/Reveal';
import { apiGet } from '@/lib/api-server';
import type { Category, ProductSummary } from '@/lib/types';

export const metadata = { title: 'Shop' };

export default async function Products({ searchParams }: { searchParams: Promise<{ category?: string; q?: string; sort?: string }> }) {
  const { category, q, sort } = await searchParams;
  const qs = new URLSearchParams({ ...(category ? { category } : {}), ...(q ? { q } : {}), ...(sort ? { sort } : {}) });
  const [products, categories] = await Promise.all([
    apiGet<{ data: ProductSummary[] }>(`/v1/store/products?${qs}`, { revalidate: 30 }),
    apiGet<{ data: Category[] }>('/v1/store/categories', { revalidate: 300 }),
  ]);
  const list = products?.data ?? [];
  const current = categories?.data.find((c) => c.slug === category);
  const chip = (active: boolean) => `whitespace-nowrap rounded-pill px-4 py-2 text-base transition-colors ${active ? 'bg-forest text-on-forest' : 'bg-paper-2 hover:bg-paper-3'}`;

  return (
    <div className="mx-auto max-w-[1240px] px-4 pb-10 pt-10 md:px-6">
      <div className="rounded-5 bg-paper-2 p-6 md:p-10">
        <p className="text-sm uppercase tracking-[0.14em] text-ink-2">{q ? 'Search' : 'Shop'}</p>
        <h1 className="mt-2 font-display text-[clamp(36px,5vw,64px)] leading-none">{q ? `“${q}”` : (current?.name ?? 'The whole pantry')}</h1>
        {current && <p className="mt-3 max-w-xl text-lg text-ink-2">{current.blurb}</p>}
        <form action="/products" role="search" className="mt-6 flex max-w-xl rounded-pill bg-paper p-1.5 shadow-card">
          {category && <input type="hidden" name="category" value={category} />}
          <label htmlFor="q" className="sr-only">
            Search products
          </label>
          <input id="q" name="q" defaultValue={q} placeholder="Search: ghee, doodh powder, peda…" className="h-11 w-full rounded-pill bg-transparent px-4 text-base outline-none placeholder:text-ink-3" />
          <button className="h-11 rounded-pill bg-forest px-6 text-on-forest">Search</button>
        </form>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Categories" className="flex gap-2 overflow-x-auto pb-1">
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
            <Link key={v} href={`/products?${new URLSearchParams({ ...(category ? { category } : {}), ...(q ? { q } : {}), ...(v ? { sort: v } : {}) })}`} className={`rounded-pill px-3 py-1.5 ${(sort ?? '') === v ? 'bg-paper-3' : 'hover:bg-paper-2'}`}>
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
        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {list.map((p, i) => (
            <Reveal key={p.id} delay={(i % 4) * 0.05}>
              <ProductCard product={p} />
            </Reveal>
          ))}
        </div>
      )}
    </div>
  );
}
