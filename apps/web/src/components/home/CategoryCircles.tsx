import { PackShot } from '@dairy/ui';
import Link from 'next/link';
import type { Category } from '@/lib/types';

export function CategoryCircles({ categories }: { categories: Category[] }) {
  return (
    <ul className="-mx-4 flex snap-x gap-4 no-scrollbar overflow-x-auto px-4 pb-2 md:mx-0 md:flex-wrap md:gap-8 md:overflow-visible md:px-0">
      {categories.map((c) => (
        <li key={c.slug} className="w-[96px] shrink-0 snap-start md:w-[140px]">
          <Link href={`/products?category=${c.slug}`} className="group flex flex-col items-center text-center">
            <span className="relative grid aspect-square w-full place-items-center overflow-hidden rounded-pill bg-meadow transition-colors group-hover:bg-paper-3">
              {c.packs[0] && (
                <span className="flex h-[62%] items-end transition-transform duration-300 group-hover:scale-110">
                  <PackShot kind={c.packs[0].kind} color={c.packs[0].color} accent={c.packs[0].accent} label="" className="h-full w-auto" />
                </span>
              )}
            </span>
            <span className="mt-2 text-[13px] font-semibold leading-tight md:text-[15px]">{c.name}</span>
            <span className="text-[12px] text-ink-3">{c.productCount} items</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
