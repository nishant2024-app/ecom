import { VegMark } from '@dairy/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ProductBuy } from '@/components/ProductBuy';
import { ProductCard } from '@/components/ProductCard';
import { Reveal } from '@/components/Reveal';
import { Reviews } from '@/components/Reviews';
import { apiGet } from '@/lib/api-server';
import { shelfLife } from '@/lib/format';
import { SITE_NAME, SITE_URL } from '@/lib/site';
import type { ProductDetail, ReviewPage } from '@/lib/types';

export const revalidate = 30;

const getProduct = (slug: string) => apiGet<ProductDetail>(`/v1/store/products/${slug}`, { revalidate: 30 });

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const product = await getProduct((await params).slug);
  if (!product) return { title: 'Not found', robots: { index: false } };
  const v = product.variants[0];
  const description = `${product.tagline}. ${v ? `From ₹${(product.fromPrice.amount / 100).toLocaleString('en-IN')}, keeps ${shelfLife(v.shelfLifeDays)} sealed.` : ''} Shipped across India.`.slice(0, 165);
  const images = product.gallery.length ? product.gallery.slice(0, 1).map((g) => ({ url: g.url, width: g.width, height: g.height, alt: g.alt })) : undefined;
  return {
    title: `${product.name} (${product.variants.map((x) => x.packSize).join(', ')})`,
    description,
    alternates: { canonical: `/p/${product.slug}` },
    openGraph: { type: 'website', title: product.name, description, url: `/p/${product.slug}`, ...(images ? { images } : {}) },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [product, reviews] = await Promise.all([getProduct(slug), apiGet<ReviewPage>(`/v1/store/products/${slug}/reviews`, { revalidate: 60 })]);
  if (!product) notFound();
  const a = product.attributes;
  const first = product.variants[0];
  const label: [string, string][] = [
    ...(a.animal ? [['Milk from', a.animal === 'cow' ? (a.a2 ? 'Gir cows (A2)' : 'Cows') : a.animal === 'buffalo' ? 'Buffaloes' : 'Cows and buffaloes'] as [string, string]] : []),
    ...(a.ingredients ? [['Ingredients', a.ingredients] as [string, string]] : []),
    ...(a.process ? [['How it is made', a.process] as [string, string]] : []),
    ...(a.fatPercent !== undefined ? [['Fat', `${a.fatPercent}%`] as [string, string]] : []),
    ...(first ? [['Shelf life', `${shelfLife(first.shelfLifeDays)} sealed`] as [string, string]] : []),
    ['Storage', product.storage === 'ambient' ? 'Room temperature, away from sunlight' : product.storage === 'cool_dry' ? 'Cool, dry place' : 'Refrigerate'],
    ...(a.sourceFarm ? [['Made at', a.sourceFarm] as [string, string]] : []),
  ];
  const url = `${SITE_URL}/p/${product.slug}`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Product',
        name: product.name,
        description: product.description,
        url,
        brand: { '@type': 'Brand', name: SITE_NAME },
        category: product.category.name,
        ...(product.gallery.length ? { image: product.gallery.map((g) => g.url) } : {}),
        ...(reviews && reviews.summary.count > 0
          ? {
              aggregateRating: { '@type': 'AggregateRating', ratingValue: reviews.summary.average, reviewCount: reviews.summary.count, bestRating: 5, worstRating: 1 },
              review: reviews.data.slice(0, 5).map((r) => ({ '@type': 'Review', reviewRating: { '@type': 'Rating', ratingValue: r.rating, bestRating: 5 }, author: { '@type': 'Person', name: r.author }, datePublished: r.createdAt.slice(0, 10), ...(r.body ? { reviewBody: r.body } : {}) })),
            }
          : {}),
        offers: product.variants.map((v) => ({
          '@type': 'Offer',
          sku: v.sku,
          name: `${product.name} ${v.packSize}`,
          url,
          priceCurrency: 'INR',
          price: (v.price.amount / 100).toFixed(2),
          itemCondition: 'https://schema.org/NewCondition',
          availability: v.inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
          shippingDetails: { '@type': 'OfferShippingDetails', shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'IN' } },
        })),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Shop', item: `${SITE_URL}/products` },
          { '@type': 'ListItem', position: 2, name: product.category.name, item: `${SITE_URL}/products?category=${product.category.slug}` },
          { '@type': 'ListItem', position: 3, name: product.name, item: url },
        ],
      },
    ],
  };

  return (
    <div className="mx-auto max-w-[1280px] px-4 pb-10 pt-5 md:px-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <nav aria-label="Breadcrumb" className="text-[13px] text-ink-2 [&_a]:inline-block [&_a]:py-2">
        <Link href="/" className="hover:text-forest">Home</Link> /{' '}
        <Link href={`/products?category=${product.category.slug}`} className="hover:text-forest">{product.category.name}</Link> / <span className="text-ink-2">{product.name}</span>
      </nav>

      <ProductBuy product={product}>
        <p className="text-[13px] font-semibold text-forest">{product.category.name}</p>
        <h1 className="mt-1 text-[28px] font-extrabold leading-tight tracking-[-0.03em] md:text-[36px]">{product.name}</h1>
        {product.rating && (
          <a href="#reviews" className="mt-2 inline-flex items-center gap-1.5 text-[14px] hover:underline">
            <span className="text-[#e3a008]" aria-hidden>★</span>
            <span className="font-semibold">{product.rating.average.toFixed(1)}</span>
            <span className="text-ink-2">({product.rating.count} review{product.rating.count === 1 ? '' : 's'})</span>
          </a>
        )}
        <p className="mt-2 flex items-center gap-2 text-[16px] text-ink-2">
          {product.isVeg && <VegMark />}
          {product.tagline}
        </p>
      </ProductBuy>

      <div className="mt-12 grid gap-6 lg:grid-cols-12 md:mt-16">
        <Reveal className="rounded-5 bg-paper-2 p-6 lg:col-span-7 md:p-8">
          <h2 className="text-[22px] font-extrabold tracking-[-0.02em]">About this product</h2>
          <p className="mt-3 text-[16px] leading-relaxed text-ink-2">{product.description}</p>
        </Reveal>
        {/* Styled like the back-of-pack label: what's in it, how to keep it, the legal numbers. */}
        <Reveal className="lg:col-span-5" delay={0.08}>
          <section aria-labelledby="label-h" className="rounded-5 border border-rule bg-paper p-6">
            <h2 id="label-h" className="text-[22px] font-extrabold tracking-[-0.02em]">Product details</h2>
            <dl className="mt-3">
              {label.map(([k, v]) => (
                <div key={k} className="grid grid-cols-[9rem_1fr] gap-4 border-b border-rule py-2.5 text-[14px]">
                  <dt className="text-ink-3">{k}</dt>
                  <dd className="font-medium">{v}</dd>
                </div>
              ))}
            </dl>
            {product.nutrition.length > 0 && (
              <>
                <p className="mt-5 flex justify-between pb-1 font-bold">
                  <span>Nutrition</span>
                  <span className="self-end text-[12px] font-normal text-ink-3">per 100 g</span>
                </p>
                <dl>
                  {product.nutrition.map((n) => (
                    <div key={n.label} className="flex justify-between border-b border-rule py-2 text-[14px]">
                      <dt>{n.label}</dt>
                      <dd className="num">{n.per100}</dd>
                    </div>
                  ))}
                </dl>
              </>
            )}
            <p className="mt-4 text-[12px] text-ink-3">
              HSN <span className="num">{product.hsnCode}</span>
              {product.fssaiNumber && (
                <>
                  {' · '}FSSAI <span className="num">{product.fssaiNumber}</span>
                </>
              )}
              {' · '}Prices include GST
            </p>
          </section>
        </Reveal>
      </div>

      <Reviews slug={product.slug} initial={reviews} />

      {product.related.length > 0 && (
        <section className="mt-14">
          <div className="mb-4 flex items-end justify-between">
            <h2 className="text-[22px] font-extrabold tracking-[-0.025em] md:text-[28px]">You may also like</h2>
            <Link href={`/products?category=${product.category.slug}`} className="inline-flex min-h-[44px] items-center text-[14px] font-semibold text-forest hover:underline">See all →</Link>
          </div>
          <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
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
