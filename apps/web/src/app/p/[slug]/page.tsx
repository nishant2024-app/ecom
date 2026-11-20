import { VegMark } from '@dairy/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ProductBuy } from '@/components/ProductBuy';
import { ProductCard } from '@/components/ProductCard';
import { Reveal } from '@/components/Reveal';
import { apiGet } from '@/lib/api-server';
import { shelfLife } from '@/lib/format';
import { SITE_NAME, SITE_URL } from '@/lib/site';
import type { ProductDetail } from '@/lib/types';

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
  const product = await getProduct(slug);
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
    <div className="mx-auto max-w-[1320px] px-4 pb-10 pt-6 md:px-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <nav aria-label="Breadcrumb" className="label text-ink-2">
        <Link href="/products" className="hover:text-ink">Shop</Link>
        <span aria-hidden className="mx-2">/</span>
        <Link href={`/products?category=${product.category.slug}`} className="hover:text-ink">{product.category.name}</Link>
      </nav>

      <ProductBuy product={product}>
        <h1 className="font-display text-[clamp(36px,4.2vw,58px)] leading-[1.02] tracking-[-0.01em]">{product.name}</h1>
        <p className="mt-3 flex items-center gap-2 font-serif text-xl italic text-ink-2">
          {product.isVeg && <VegMark />}
          {product.tagline}
        </p>
      </ProductBuy>

      <div className="mt-24 grid gap-12 lg:grid-cols-12">
        <Reveal className="lg:col-span-6">
          <h2 className="font-display text-[34px] leading-tight">About it</h2>
          <p className="mt-5 font-serif text-[20px] leading-[1.6] text-ink-2">{product.description}</p>
        </Reveal>
        {/* Styled like the back-of-pack label: what's in it, how to keep it, the legal numbers. */}
        <Reveal className="lg:col-span-5 lg:col-start-8" delay={0.08}>
          <section aria-labelledby="label-h" className="border-2 border-ink bg-paper p-5">
            <h2 id="label-h" className="font-display text-2xl">On the label</h2>
            <dl className="mt-3 border-t-[6px] border-ink">
              {label.map(([k, v]) => (
                <div key={k} className="grid grid-cols-[9rem_1fr] gap-4 border-b border-ink/30 py-2 text-[15px]">
                  <dt className="font-medium">{k}</dt>
                  <dd className="text-ink-2">{v}</dd>
                </div>
              ))}
            </dl>
            {product.nutrition.length > 0 && (
              <>
                <p className="mt-5 flex justify-between border-b-[3px] border-ink pb-1 font-medium">
                  <span>Nutrition</span>
                  <span className="label self-end">per 100 g</span>
                </p>
                <dl>
                  {product.nutrition.map((n) => (
                    <div key={n.label} className="flex justify-between border-b border-ink/30 py-1.5 text-[15px]">
                      <dt>{n.label}</dt>
                      <dd className="num">{n.per100}</dd>
                    </div>
                  ))}
                </dl>
              </>
            )}
            <p className="label mt-4 text-ink-2">
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

      {product.related.length > 0 && (
        <section className="mt-28">
          <div className="flex items-baseline justify-between border-b border-ink pb-4">
            <h2 className="font-display text-[34px] leading-tight">More {product.category.name.toLowerCase()}</h2>
            <Link href={`/products?category=${product.category.slug}`} className="underline underline-offset-4">See all</Link>
          </div>
          <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-12 md:gap-x-6 lg:grid-cols-4">
            {product.related.map((p, i) => (
              <Reveal key={p.id} delay={i * 0.06}>
                <ProductCard product={p} sizes="(min-width: 1024px) 25vw, 50vw" />
              </Reveal>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
