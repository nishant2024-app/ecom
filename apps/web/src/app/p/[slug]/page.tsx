import { VegMark } from '@dairy/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ProductBuy } from '@/components/ProductBuy';
import { ProductCard } from '@/components/ProductCard';
import { Reveal } from '@/components/Reveal';
import { apiGet } from '@/lib/api-server';
import type { ProductDetail } from '@/lib/types';

export const revalidate = 30;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const product = await apiGet<ProductDetail>(`/v1/store/products/${(await params).slug}`);
  return product ? { title: product.name, description: product.description } : { title: 'Not found' };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await apiGet<ProductDetail>(`/v1/store/products/${slug}`, { revalidate: 30 });
  if (!product) notFound();
  const a = product.attributes;
  const facts: [string, string][] = [
    ...(a.animal ? [['Milk', a.animal === 'cow' ? (a.a2 ? 'Gir cow (A2)' : 'Cow') : a.animal === 'buffalo' ? 'Buffalo' : 'Mixed'] as [string, string]] : []),
    ...(a.fatPercent !== undefined ? [['Fat', `${a.fatPercent}%`] as [string, string]] : []),
    ...(a.process ? [['Process', a.process] as [string, string]] : []),
    ...(a.ingredients ? [['Ingredients', a.ingredients] as [string, string]] : []),
    ['Storage', product.storage === 'ambient' ? 'Room temperature, away from sunlight' : product.storage === 'cool_dry' ? 'Cool, dry place' : 'Refrigerate'],
    ...(a.sourceFarm ? [['Farm', a.sourceFarm] as [string, string]] : []),
  ];
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description,
    offers: product.variants.map((v) => ({
      '@type': 'Offer',
      sku: v.sku,
      priceCurrency: 'INR',
      price: (v.price.amount / 100).toFixed(2),
      availability: v.inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
    })),
  };

  return (
    <div className="mx-auto max-w-[1240px] px-4 pb-10 pt-8 md:px-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <nav aria-label="Breadcrumb" className="text-sm text-ink-2">
        <Link href="/products" className="hover:underline">
          Shop
        </Link>
        <span aria-hidden> / </span>
        <Link href={`/products?category=${product.category.slug}`} className="hover:underline">
          {product.category.name}
        </Link>
      </nav>

      <ProductBuy product={product}>
        <h1 className="flex items-center gap-3 font-display text-[clamp(36px,4.6vw,60px)] leading-[1.02]">
          {product.isVeg && <VegMark />}
          {product.name}
        </h1>
        <p className="mt-2 text-lg text-ink-2">{product.tagline}</p>
      </ProductBuy>

      <div className="mt-16 grid gap-10 md:grid-cols-12">
        <Reveal className="md:col-span-6">
          <h2 className="font-display text-3xl">About it</h2>
          <p className="mt-4 text-lg leading-relaxed text-ink-2">{product.description}</p>
          <dl className="mt-6 divide-y divide-rule rounded-4 border border-rule bg-paper">
            {facts.map(([k, v]) => (
              <div key={k} className="flex items-baseline justify-between gap-6 px-5 py-3">
                <dt className="text-ink-2">{k}</dt>
                <dd className="text-right">{v}</dd>
              </div>
            ))}
          </dl>
        </Reveal>
        {product.nutrition.length > 0 && (
          <Reveal className="md:col-span-5 md:col-start-8" delay={0.1}>
            <h2 className="font-display text-3xl">Nutrition</h2>
            <p className="text-sm text-ink-2">Per 100 g</p>
            <dl className="mt-4 divide-y divide-rule rounded-4 bg-paper-2">
              {product.nutrition.map((n) => (
                <div key={n.label} className="flex justify-between px-5 py-3">
                  <dt>{n.label}</dt>
                  <dd className="num">{n.per100}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-xs text-ink-2">
              Prices include GST · HSN <span className="num">{product.hsnCode}</span>
              {product.fssaiNumber && (
                <>
                  {' '}· FSSAI <span className="num">{product.fssaiNumber}</span>
                </>
              )}
            </p>
          </Reveal>
        )}
      </div>

      {product.related.length > 0 && (
        <section className="mt-20">
          <h2 className="font-display text-3xl">From the same shelf</h2>
          <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {product.related.map((p, i) => (
              <Reveal key={p.id} delay={i * 0.06}>
                <ProductCard product={p} />
              </Reveal>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
