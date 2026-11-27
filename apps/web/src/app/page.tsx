import { CategoryCircles } from '@/components/home/CategoryCircles';
import { Faq } from '@/components/home/Faq';
import { FreshThisWeek, type FreshItem } from '@/components/home/FreshThisWeek';
import { HeroCarousel, type BannerPack } from '@/components/home/HeroCarousel';
import { QualityBand } from '@/components/home/QualityBand';
import { PincodeStrip } from '@/components/home/PincodeStrip';
import { SectionHeader } from '@/components/home/SectionHeader';
import { ShopTabs } from '@/components/home/ShopTabs';
import { TrustRow } from '@/components/home/TrustRow';
import { WhyUs } from '@/components/home/WhyUs';
import { ProductCard } from '@/components/ProductCard';
import { Reveal } from '@/components/Reveal';
import { apiGet } from '@/lib/api-server';
import { getContent } from '@/lib/content';
import { SITE_URL } from '@/lib/site';
import type { Category, ProductSummary } from '@/lib/types';

export const revalidate = 60;

const grid = 'grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4 lg:grid-cols-5 [&>*:nth-child(5)]:hidden lg:[&>*:nth-child(5)]:block';

export default async function Home() {
  const [products, categories, content, fresh] = await Promise.all([
    apiGet<{ data: ProductSummary[] }>('/v1/store/products'),
    apiGet<{ data: Category[] }>('/v1/store/categories', { revalidate: 300 }),
    getContent(),
    apiGet<{ data: FreshItem[] }>('/v1/store/fresh', { revalidate: 300 }),
  ]);
  const all = products?.data ?? [];
  const cats = (categories?.data ?? []).filter((c) => c.productCount > 0);
  const bestsellers = [...all.filter((p) => p.featured), ...all.filter((p) => !p.featured)].slice(0, 5);
  // Drawn packs for each banner: products from the banner's category, featured first.
  const toPack = (p: ProductSummary): BannerPack => ({ slug: p.slug, name: p.name, size: p.variants[0]?.packSize ?? '', pack: p.pack });
  const ranked = [...all.filter((p) => p.featured), ...all.filter((p) => !p.featured)];
  const packsFor: Record<string, BannerPack[]> = { __all: [...new Map(ranked.map((p) => [p.category.slug, p])).values()].slice(0, 3).map(toPack) };
  for (const c of cats) {
    const list = ranked
      .filter((p) => p.category.slug === c.slug)
      .slice(0, 3)
      .map(toPack);
    // Tallest pack in the middle.
    if (list.length === 3) list.splice(1, 0, list.splice(0, 1)[0]!);
    packsFor[c.slug] = list;
  }
  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: bestsellers.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE_URL}/p/${p.slug}`, name: p.name })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemList) }} />
      <h1 className="sr-only">{content.hero.title}</h1>
      <HeroCarousel banners={content.banners} images={content.images.banners} packsFor={packsFor} />
      <TrustRow items={content.promises} />

      <div className="mx-auto max-w-[1280px] space-y-12 px-4 pt-10 md:space-y-16 md:px-6 md:pt-14">
        <section>
          <SectionHeader title="Shop by category" />
          <CategoryCircles categories={cats} />
        </section>

        <PincodeStrip />

        <FreshThisWeek items={fresh?.data ?? []} />

        <section>
          <SectionHeader title="Bestsellers" sub="Our most popular products" href="/products" link="See all" />
          <div className={grid}>
            {bestsellers.map((p, i) => (
              <Reveal key={p.id} delay={(i % 5) * 0.04} y={16}>
                <ProductCard product={p} priority={i < 2} />
              </Reveal>
            ))}
          </div>
        </section>

        <section>
          <SectionHeader title="Shop all" sub="Everything ships across India in sealed, batch-coded packs" />
          <ShopTabs products={all} categories={cats} />
        </section>

        <QualityBand />

        <WhyUs content={content} />

        <section id="questions" className="grid scroll-mt-24 gap-6 md:grid-cols-[1fr_2fr] md:gap-10">
          <div>
            <h2 className="text-[26px] font-extrabold tracking-[-0.03em] md:text-[34px]">Questions?</h2>
            <p className="mt-2 text-[15px] text-ink-2">Shipping, shelf life, payments and cancellations. Anything else, contact us from the footer.</p>
          </div>
          <Faq />
        </section>
      </div>
    </>
  );
}
