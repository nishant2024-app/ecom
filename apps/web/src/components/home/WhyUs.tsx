import type { StoreContent } from '@/lib/types';
import { CheckIcon } from '../icons';
import { Photo } from '../ProductImage';

const POINTS = [
  'Made from our own herd’s milk in Mulshi, near Pune',
  'Batch number and expiry date printed on every pack',
  'Oldest safe batch shipped first, never less than 7 days of shelf life',
  'No preservatives needed: ghee, powder and UHT keep naturally',
  'Cancel any time before we pack for a full refund',
];

export function WhyUs({ content }: { content: StoreContent }) {
  const img = content.images.story;
  return (
    <section id="story" className="grid scroll-mt-24 overflow-hidden rounded-5 bg-paper-2 md:grid-cols-2">
      <div className="p-6 md:p-10">
        <h2 className="text-[26px] font-extrabold leading-tight tracking-[-0.03em] md:text-[34px]">{content.story.title || 'Why shop with us?'}</h2>
        {content.story.paragraphs[0] && <p className="mt-3 text-[16px] leading-relaxed text-ink-2">{content.story.paragraphs[0]}</p>}
        <ul className="mt-6 space-y-3">
          {POINTS.map((p) => (
            <li key={p} className="flex items-start gap-3 text-[15px]">
              <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-pill bg-forest text-on-forest">
                <CheckIcon size={14} />
              </span>
              {p}
            </li>
          ))}
        </ul>
        {content.story.signature && <p className="mt-6 text-[14px] font-semibold text-ink-2">— {content.story.signature}</p>}
      </div>
      <div className="relative min-h-[260px] bg-meadow">
        {img ? (
          <Photo img={img} sizes="(min-width: 768px) 50vw, 100vw" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 grid place-items-center p-8">
            <div className="w-full max-w-[320px] rotate-[-2deg] rounded-4 bg-paper p-5 shadow-card">
              <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-forest">Printed on every pack</p>
              <dl className="num mt-3 space-y-2 text-[14px]">
                {[
                  ['Batch', 'GHE-A2-261117'],
                  ['Made on', '17 Nov 2026'],
                  ['Best before', '18 Aug 2027'],
                  ['Net qty', '500 ml'],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between border-b border-dashed border-rule pb-2">
                    <dt className="text-ink-2">{k}</dt>
                    <dd className="font-semibold">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
