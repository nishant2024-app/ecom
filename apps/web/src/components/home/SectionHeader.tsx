import Link from 'next/link';
import { ArrowIcon } from '../icons';

export function SectionHeader({ title, sub, href, link = 'See all' }: { title: string; sub?: string; href?: string; link?: string }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4 md:mb-5">
      <div>
        <h2 className="text-[22px] font-extrabold tracking-[-0.025em] md:text-[28px]">{title}</h2>
        {sub && <p className="mt-0.5 text-[14px] text-ink-2 md:text-[15px]">{sub}</p>}
      </div>
      {href && (
        <Link href={href} className="inline-flex shrink-0 items-center gap-1 text-[14px] font-semibold text-forest hover:underline">
          {link} <ArrowIcon size={16} />
        </Link>
      )}
    </div>
  );
}
