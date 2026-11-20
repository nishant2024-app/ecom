import type { ProductSummary } from '@/lib/types';

/**
 * Product visual. Uses the real photo when one exists; until the product shoot is done it
 * shows a typographic tile (pack size and fat %) instead of stock or AI imagery.
 */
export function ProductTile({ product, large = false }: { product: ProductSummary; large?: boolean }) {
  if (product.image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={product.image.url}
        alt={product.image.alt}
        width={product.image.width || 800}
        height={product.image.height || 1000}
        loading={large ? 'eager' : 'lazy'}
        className="aspect-[4/5] w-full rounded-2 bg-paper-2 object-cover"
      />
    );
  }
  const v = product.variants[0];
  const fat = product.attributes.fatPercent;
  return (
    <div aria-hidden className="relative flex aspect-[4/5] w-full flex-col justify-between overflow-hidden rounded-2 bg-paper-2 p-4">
      <span className="text-xs uppercase tracking-[0.14em] text-ink-2">{product.category.name}</span>
      <span className={`num leading-none text-ink ${large ? 'text-[clamp(56px,9vw,120px)]' : 'text-[clamp(36px,6vw,56px)]'}`}>
        {v?.packSize.replace(' glass bottle', '')}
      </span>
      <span className="flex items-end justify-between gap-2 text-sm text-ink-2">
        {large && <span className="font-display text-ink">{product.name}</span>}
        {fat !== undefined && <span className="num ml-auto whitespace-nowrap">{fat}% fat</span>}
      </span>
      <span className="pointer-events-none absolute -right-6 top-10 h-40 w-40 rounded-pill border border-rule" />
    </div>
  );
}
