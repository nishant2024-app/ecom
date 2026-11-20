import { Money, VegMark } from '@dairy/ui';
import Link from 'next/link';
import type { ProductSummary } from '@/lib/types';
import { ProductTile } from './ProductTile';

export function ProductCard({ product }: { product: ProductSummary }) {
  const v = product.variants[0];
  const sub = product.variants.find((x) => x.subscriptionPrice);
  return (
    <Link href={`/p/${product.slug}`} className="group block focus-visible:shadow-none">
      <ProductTile product={product} />
      <div className="mt-3 flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-lg leading-snug group-hover:underline group-hover:underline-offset-4">
            {product.isVeg && <VegMark />}
            {product.name}
          </h3>
          <p className="text-sm text-ink-2">
            {product.variants.map((x) => x.packSize).join(' · ')}
          </p>
        </div>
        <div className="sm:text-right">
          <Money paise={v?.price.amount ?? 0} className="text-lg" />
          {sub?.subscriptionPrice && (
            <p className="text-xs text-ink-2">
              <Money paise={sub.subscriptionPrice.amount} /> on subscription
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}
