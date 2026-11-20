import Link from 'next/link';
import { Faq } from '@/components/home/Faq';
import { Hero } from '@/components/home/Hero';
import { Promises } from '@/components/home/Promises';
import type { ShelfItem } from '@/components/home/Shelf';
import { Shelves } from '@/components/home/Shelves';
import { Story } from '@/components/home/Story';
import { Timeline } from '@/components/home/Timeline';
import { ProductCard } from '@/components/ProductCard';
import { Reveal } from '@/components/Reveal';
import { apiGet } from '@/lib/api-server';
import { getContent } from '@/lib/content';
import { SITE_URL } from '@/lib/site';
import type { Category, ProductSummary } from '@/lib/types';

export const revalidate = 60;

const rupees = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

export default async function Home() {
  const [products, categories, content] = await Promise.all([
    apiGet<{ data: ProductSummary[] }>('/v1/store/products'),
    apiGet<{ data: Category[] }>('/v1/store/categories', { revalidate: 300 }),
    getContent(),
  ]);
  const all = products?.data ?? [];
  const featured = [...all.filter((p) => p.featured), ...all.filter((p) => !p.featured)].slice(0, 8);
  // One product per category first, so the shelf shows the range.
  const byCategory = [...new Map(all.map((p) => [p.category.slug, p])).values()];
  const shelf: ShelfItem[] = [...byCategory, ...all.filter((p) => !byCategory.includes(p))].slice(0, 6).map((p) => ({
    slug: p.slug,
    name: p.name,
    size: p.variants[0]?.packSize ?? '',
    price: rupees(p.variants[0]?.price.amount ?? 0),
    pack: p.pack,
  }));
  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: featured.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE_URL}/p/${p.slug}`, name: p.name })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemList) }} />
      <Hero content={content} shelf={shelf} />
      <Promises items={content.promises} />

      <section className="mx-auto max-w-[1320px] px-4 pt-24 md:px-8">
        <div className="flex flex-wrap items-baseline justify-between gap-4 pb-8">
          <h2 className="font-display text-[clamp(34px,4vw,56px)] leading-none">In the pantry</h2>
          <Link href="/products" className="text-[17px] underline decoration-1 underline-offset-[6px] hover:decoration-2">
            All {all.length} products
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-12 md:gap-x-6 lg:grid-cols-4">
          {featured.map((p, i) => (
            <Reveal key={p.id} delay={(i % 4) * 0.06}>
              <ProductCard product={p} priority={i < 2} sizes="(min-width: 1024px) 25vw, 50vw" />
            </Reveal>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-[1320px] px-4 pt-28 md:px-8">
        <h2 className="sr-only">Shop by kind</h2>
        <Shelves categories={categories?.data ?? []} />
      </section>

      <div className="pt-28">
        <Story content={content} />
      </div>

      <section className="mx-auto max-w-[1320px] px-4 pt-28 md:px-8">
        <Timeline />
      </section>

      <section id="questions" className="mx-auto grid max-w-[1320px] scroll-mt-24 gap-10 px-4 pt-28 md:px-8 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <h2 className="font-display text-[clamp(34px,4vw,56px)] leading-[1.02]">Questions people ask</h2>
          <p className="mt-4 max-w-sm text-[17px] text-ink-2">Anything else, write to us. The address is at the bottom of the page and a person answers.</p>
        </div>
        <div className="lg:col-span-8">
          <Faq />
        </div>
      </section>
    </>
  );
}
