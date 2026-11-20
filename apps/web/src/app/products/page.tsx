import Link from 'next/link';
import { ProductCard } from '@/components/ProductCard';
import { apiGet } from '@/lib/api-server';
import type { Category, ProductSummary } from '@/lib/types';

export const metadata = { title: 'All products' };

export default async function Products({ searchParams }: { searchParams: Promise<{ category?: string; q?: string }> }) {
  const { category, q } = await searchParams;
  const qs = new URLSearchParams({ ...(category ? { category } : {}), ...(q ? { q } : {}) });
  const [products, categories] = await Promise.all([
    apiGet<{ data: ProductSummary[] }>(`/v1/store/products?${qs}`),
    apiGet<{ data: Category[] }>('/v1/store/categories', { revalidate: 300 }),
  ]);
  const list = products?.data ?? [];
  const current = categories?.data.find((c) => c.slug === category);

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-10 md:px-6">
      <div className="grid gap-6 rule-b pb-6 md:grid-cols-12 md:items-end">
        <h1 className="font-display text-2xl md:col-span-6 md:text-[44px] md:leading-tight">{q ? `“${q}”` : (current?.name ?? 'Everything we make')}</h1>
        <form action="/products" className="flex md:col-span-5 md:col-start-8" role="search">
          {category && <input type="hidden" name="category" value={category} />}
          <label htmlFor="q" className="sr-only">
            Search products
          </label>
          <input
            id="q"
            name="q"
            defaultValue={q}
            placeholder="Search: doodh, paneer, ghee…"
            className="h-12 w-full rounded-l-1 border border-r-0 border-ink bg-paper px-4 text-base placeholder:text-ink-3"
          />
          <button className="h-12 rounded-r-1 bg-ink px-5 text-base text-paper">Search</button>
        </form>
      </div>
      <nav aria-label="Categories" className="mt-4 flex gap-2 overflow-x-auto pb-2">
        <Link
          href="/products"
          aria-current={!category ? 'page' : undefined}
          className={`whitespace-nowrap rounded-pill border px-4 py-1.5 text-sm ${!category ? 'border-ink bg-ink text-paper' : 'border-rule hover:border-ink'}`}
        >
          All
        </Link>
        {categories?.data.map((c) => (
          <Link
            key={c.slug}
            href={`/products?category=${c.slug}`}
            aria-current={category === c.slug ? 'page' : undefined}
            className={`whitespace-nowrap rounded-pill border px-4 py-1.5 text-sm ${category === c.slug ? 'border-ink bg-ink text-paper' : 'border-rule hover:border-ink'}`}
          >
            {c.name}
          </Link>
        ))}
      </nav>
      {list.length === 0 ? (
        <p className="mt-16 max-w-md text-lg text-ink-2">
          Nothing matches that. Try “milk”, “dahi” or “ghee”, or{' '}
          <Link href="/products" className="text-ink underline underline-offset-4">
            see everything
          </Link>
          .
        </p>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 md:gap-x-6 lg:grid-cols-4">
          {list.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
