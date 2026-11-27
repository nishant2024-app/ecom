import { PackShot } from '@dairy/ui';
import type { Img, Pack } from '@/lib/types';

/**
 * The owner's photo when there is one (pre-resized WebP from the API, so no image optimiser is needed),
 * otherwise the drawn pack.
 */
export function Photo({ img, sizes, className = '', priority = false }: { img: Img; sizes: string; className?: string; priority?: boolean }) {
  return (
    <img
      src={img.url}
      srcSet={img.srcset.map((s) => `${s.url} ${s.width}w`).join(', ')}
      sizes={sizes}
      width={img.width}
      height={img.height}
      alt={img.alt}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : 'auto'}
      decoding="async"
      className={className}
    />
  );
}

export function ProductImage({
  image,
  pack,
  name,
  size,
  sizes,
  priority,
  className = '',
}: {
  image: Img | null;
  pack: Pack;
  name: string;
  size?: string;
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  if (image) return <Photo img={image} sizes={sizes} priority={priority} className={`h-full w-full object-cover ${className}`} />;
  return (
    <div className={`flex h-full w-full items-end justify-center px-[18%] pb-[8%] pt-[10%] ${className}`}>
      <PackShot kind={pack.kind} color={pack.color} accent={pack.accent} label={name} size={size} className="h-full w-auto max-w-full" />
    </div>
  );
}
