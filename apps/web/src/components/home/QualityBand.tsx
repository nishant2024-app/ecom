import Link from 'next/link';
import { ArrowIcon, ClockIcon, ShieldIcon, TruckIcon } from '../icons';

const ITEMS = [
  { icon: <ShieldIcon />, title: 'Verify every pack', body: 'Type the batch code from your jar and see when it was made.', href: '/verify', cta: 'Verify a pack' },
  { icon: <ClockIcon />, title: 'Freshness before you buy', body: 'Each product page shows the made-on date of the batch you will get.', href: '/products', cta: 'See products' },
  { icon: <TruckIcon />, title: 'Cancel until packed', body: 'Changed your mind? Cancel from your account for a full refund.', href: '/refunds', cta: 'Read the policy' },
];

export function QualityBand() {
  return (
    <section aria-labelledby="quality-h">
      <h2 id="quality-h" className="text-[22px] font-extrabold tracking-[-0.025em] md:text-[28px]">Buy with confidence</h2>
      <ul className="mt-4 grid gap-3 md:grid-cols-3">
        {ITEMS.map((it) => (
          <li key={it.title}>
            <Link href={it.href} className="group flex h-full flex-col rounded-5 border border-rule bg-paper p-5 transition-colors hover:border-forest">
              <span className="grid h-12 w-12 place-items-center rounded-pill bg-meadow text-forest">{it.icon}</span>
              <span className="mt-4 text-[17px] font-bold">{it.title}</span>
              <span className="mt-1 flex-1 text-[14px] leading-relaxed text-ink-2">{it.body}</span>
              <span className="mt-4 inline-flex items-center gap-1 text-[14px] font-semibold text-forest">
                {it.cta} <span className="transition-transform group-hover:translate-x-0.5"><ArrowIcon size={16} /></span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
