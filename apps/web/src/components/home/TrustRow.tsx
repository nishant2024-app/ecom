import type { StoreContent } from '@/lib/types';
import { CardIcon, ClockIcon, ShieldIcon, TruckIcon } from '../icons';

const ICONS = [<ShieldIcon key="s" />, <TruckIcon key="t" />, <ClockIcon key="c" />, <CardIcon key="p" />];

/** The four promises edited in Admin → Storefront, as a compact row under the banner. */
export function TrustRow({ items }: { items: StoreContent['promises'] }) {
  if (!items.length) return null;
  return (
    <ul className="mx-auto mt-4 grid max-w-[1280px] grid-cols-2 gap-2 px-4 md:grid-cols-4 md:gap-3 md:px-6">
      {items.map((p, i) => (
        <li key={p.title} className="flex items-center gap-3 rounded-4 bg-paper-2 p-3 sm:items-start md:p-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-pill bg-paper text-forest">{ICONS[i % ICONS.length]}</span>
          <span className="min-w-0">
            <span className="block text-[14px] font-bold leading-tight md:text-[15px]">{p.title}</span>
            <span className="mt-0.5 hidden text-[13px] leading-snug text-ink-2 sm:block">{p.body}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
