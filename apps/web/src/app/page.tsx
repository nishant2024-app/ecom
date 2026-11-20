import Link from 'next/link';
import { Categories } from '@/components/home/Categories';
import { Faq } from '@/components/home/Faq';
import { Hero, type HeroPack } from '@/components/home/Hero';
import { Marquee } from '@/components/home/Marquee';
import { Process } from '@/components/home/Process';
import { ReelVideo } from '@/components/home/ReelVideo';
import { Stats } from '@/components/home/Stats';
import { ProductCard } from '@/components/ProductCard';
import { Reveal } from '@/components/Reveal';
import { apiGet } from '@/lib/api-server';
import type { Category, ProductSummary } from '@/lib/types';

export const revalidate = 60;

function SectionHead({ eyebrow, title, href, link }: { eyebrow: string; title: string; href?: string; link?: string }) {
  return (
    <Reveal className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-sm uppercase tracking-[0.14em] text-ink-2">{eyebrow}</p>
        <h2 className="mt-2 font-display text-[clamp(32px,4.4vw,56px)] leading-[1.02]">{title}</h2>
      </div>
      {href && (
        <Link href={href} className="rounded-pill border border-forest px-5 py-2.5 hover:bg-paper-2">
          {link}
        </Link>
      )}
    </Reveal>
  );
}

export default async function Home() {
  const [products, categories] = await Promise.all([
    apiGet<{ data: ProductSummary[] }>('/v1/store/products'),
    apiGet<{ data: Category[] }>('/v1/store/categories', { revalidate: 300 }),
  ]);
  const all = products?.data ?? [];
  // Featured first, then the rest, to fill two full rows.
  const featured = [...all.filter((p) => p.featured), ...all.filter((p) => !p.featured)].slice(0, 8);
  const order = ['a2-gir-cow-ghee', 'whole-milk-powder', 'kesar-badam-milk', 'kandi-peda', 'uht-toned-milk'];
  const heroPacks: HeroPack[] = order
    .map((slug) => all.find((p) => p.slug === slug))
    .filter((p): p is ProductSummary => !!p)
    .map((p) => ({ slug: p.slug, name: p.name, size: p.variants[0]?.packSize ?? '', pack: p.pack }));

  return (
    <>
      <Hero packs={heroPacks} />
      <Marquee />

      <section className="mx-auto max-w-[1240px] px-4 pt-24 md:px-6">
        <SectionHead eyebrow="Shop by shelf" title="Four kinds of dairy that wait for you" />
        <div className="mt-10">
          <Categories categories={categories?.data ?? []} />
        </div>
      </section>

      <section className="mx-auto max-w-[1240px] px-4 pt-24 md:px-6">
        <SectionHead eyebrow="Most ordered" title="Pantry favourites" href="/products" link="See all products" />
        <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {featured.map((p, i) => (
            <Reveal key={p.id} delay={i * 0.06}>
              <ProductCard product={p} />
            </Reveal>
          ))}
        </div>
      </section>

      <div className="pt-24">
        <Process />
      </div>

      <section className="mx-auto grid max-w-[1240px] items-center gap-10 px-4 pt-24 md:grid-cols-12 md:px-6">
        <Reveal className="md:col-span-5">
          <ReelVideo />
        </Reveal>
        <div className="md:col-span-7">
          <SectionHead eyebrow="Why shelf-stable" title="Made properly, it simply keeps" />
          <p className="mt-4 max-w-xl text-lg text-ink-2">
            Ghee has almost no water left in it, milk powder is dried to under 4% moisture, and UHT cartons are sterile. Nothing needs a preservative or a fridge until you open it.
          </p>
          <div className="mt-8">
            <Stats />
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-[1240px] gap-10 px-4 pt-24 md:grid-cols-12 md:px-6">
        <div className="md:col-span-4">
          <SectionHead eyebrow="Questions" title="Before you order" />
          <p className="mt-4 text-lg text-ink-2">Something else? Write to us from the footer and a person replies.</p>
        </div>
        <Reveal className="md:col-span-8">
          <Faq />
        </Reveal>
      </section>
    </>
  );
}
