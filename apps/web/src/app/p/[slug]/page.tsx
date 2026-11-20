import { Money, VegMark } from '@dairy/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ProductTile } from '@/components/ProductTile';
import { SubscribeBox } from '@/components/SubscribeBox';
import { apiGet } from '@/lib/api-server';
import type { ProductDetail } from '@/lib/types';

export const revalidate = 60;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const product = await apiGet<ProductDetail>(`/v1/store/products/${(await params).slug}`);
  return product ? { title: product.name, description: product.description } : { title: 'Not found' };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await apiGet<ProductDetail>(`/v1/store/products/${slug}`);
  if (!product) notFound();
  const a = product.attributes;
  const facts: [string, string][] = [
    ...(a.animal ? [['Milk', a.animal === 'cow' ? (a.a2 ? 'Gir cow (A2)' : 'Cow') : a.animal === 'buffalo' ? 'Buffalo' : a.animal] as [string, string]] : []),
    ...(a.fatPercent !== undefined ? [['Fat', `${a.fatPercent}%`] as [string, string]] : []),
    ...(a.snfPercent !== undefined ? [['SNF', `${a.snfPercent}%`] as [string, string]] : []),
    ...(a.pasteurised ? [['Treatment', 'Pasteurised'] as [string, string]] : []),
    ['Keeps', `${product.shelfLifeDays} ${product.shelfLifeDays === 1 ? 'day' : 'days'} ${product.storage === 'ambient' ? 'at room temperature' : 'refrigerated'}`],
    ['Pack', product.packaging === 'bottle' ? 'Glass bottle' : product.packaging === 'tub' ? 'Tub' : product.packaging === 'box' ? 'Sealed box' : 'Pouch'],
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
      availability: 'https://schema.org/InStock',
    })),
  };

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8 md:px-6 md:py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <nav aria-label="Breadcrumb" className="text-sm text-ink-2">
        <Link href="/products" className="hover:underline">
          Products
        </Link>
        <span aria-hidden> / </span>
        <Link href={`/products?category=${product.category.slug}`} className="hover:underline">
          {product.category.name}
        </Link>
      </nav>
      <div className="mt-6 grid gap-10 md:grid-cols-12">
        <div className="md:col-span-6">
          <ProductTile product={product} large />
        </div>
        <div className="md:col-span-5 md:col-start-8">
          <h1 className="flex items-center gap-3 font-display text-2xl md:text-[44px] md:leading-tight">
            {product.isVeg && <VegMark />}
            {product.name}
          </h1>
          <p className="mt-4 text-lg text-ink-2">{product.description}</p>

          <SubscribeBox slug={product.slug} variants={product.variants} />

          <dl className="mt-10 rule-t">
            {facts.map(([k, v]) => (
              <div key={k} className="flex items-baseline justify-between py-2.5 rule-b">
                <dt className="text-ink-2">{k}</dt>
                <dd className="num text-right">{v}</dd>
              </div>
            ))}
            {product.variants.some((v) => v.bottleDeposit.amount > 0) && (
              <div className="flex items-baseline justify-between py-2.5 rule-b">
                <dt className="text-ink-2">Bottle deposit</dt>
                <dd>
                  <Money paise={product.variants.find((v) => v.bottleDeposit.amount > 0)!.bottleDeposit.amount} /> refundable
                </dd>
              </div>
            )}
          </dl>
          <p className="mt-4 text-xs text-ink-2">
            Prices include GST. HSN <span className="num">{product.hsnCode}</span>
            {product.fssaiNumber && (
              <>
                {' · '}FSSAI <span className="num">{product.fssaiNumber}</span>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
