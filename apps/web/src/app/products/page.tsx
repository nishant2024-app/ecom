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

  const sortLink = (v: string) => `/products?${new URLSearchParams({ ...(category ? { category } : {}), ...(q ? { q } : {}), ...(v ? { sort: v } : {}) })}`;
  const tab = (active: boolean) => `whitespace-nowrap rounded-pill border px-4 py-2 text-[14px] font-semibold transition-colors ${active ? 'border-forest bg-forest text-on-forest' : 'border-rule bg-paper hover:border-forest'}`;

  return (
    <div className="mx-auto max-w-[1280px] px-4 pb-10 pt-6 md:px-6">
      <nav aria-label="Breadcrumb" className="text-[13px] text-ink-3">
        <Link href="/" className="hover:text-forest">Home</Link> / <span className="text-ink-2">{q ? 'Search' : (current?.name ?? 'All products')}</span>
      </nav>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-extrabold tracking-[-0.03em] md:text-[34px]">{q ? `Results for “${q}”` : (current?.name ?? 'All products')}</h1>
          <p className="mt-1 text-[15px] text-ink-2">{q ? `${list.length} product${list.length === 1 ? '' : 's'}` : (current?.blurb ?? `${list.length} products, shipped across India`)}</p>
        </div>
        <div className="flex items-center gap-2 text-[14px] text-ink-2">
          Sort
          <span className="flex gap-1 rounded-pill bg-paper-2 p-1">
            {[['', 'Popular'], ['price_asc', 'Price: low'], ['price_desc', 'Price: high']].map(([v, l]) => (
              <Link key={v} href={sortLink(v!)} className={`rounded-pill px-3 py-1.5 text-[13px] font-semibold ${(sort ?? '') === v ? 'bg-paper text-ink shadow-card' : 'text-ink-2 hover:text-ink'}`}>{l}</Link>
            ))}
          </span>
        </div>
      </div>

      <nav aria-label="Categories" className="-mx-4 mt-5 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
        <Link href="/products" aria-current={!category ? 'page' : undefined} className={tab(!category && !q)}>All</Link>
        {categories?.data.map((c) => (
          <Link key={c.slug} href={`/products?category=${c.slug}`} aria-current={category === c.slug ? 'page' : undefined} className={tab(category === c.slug)}>{c.name}</Link>
        ))}
      </nav>

      {list.length === 0 ? (
        <div className="mt-12 rounded-5 bg-paper-2 p-10 text-center">
          <p className="text-lg font-bold">No products found</p>
          <p className="mt-1 text-ink-2">Try “ghee”, “powder” or “peda”.</p>
          <Link href="/products" className="mt-5 inline-flex h-11 items-center rounded-pill bg-forest px-6 font-semibold text-on-forest">See all products</Link>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4 xl:grid-cols-5">
          {list.map((p, i) => (
            <Reveal key={p.id} delay={(i % 5) * 0.04} y={16}>
              <ProductCard product={p} priority={i < 4} />
            </Reveal>
          ))}
        </div>
      )}
    </div>
  );
}
