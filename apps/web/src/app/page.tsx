import { Money, MilkCard, type MilkCardDay } from '@dairy/ui';
import Link from 'next/link';
import { ProductCard } from '@/components/ProductCard';
import { SectionLabel } from '@/components/SectionLabel';
import { apiGet } from '@/lib/api-server';
import type { ProductSummary } from '@/lib/types';

export const revalidate = 60;

/** A fixed example month for the hero, so the page explains the milk card before sign-in. */
function exampleMonth(): { month: string; today: string; days: MilkCardDay[] } {
  const days: MilkCardDay[] = [];
  for (let d = 1; d <= 28; d++) {
    const date = `2026-02-${String(d).padStart(2, '0')}`;
    const weekend = [0, 6].includes(new Date(Date.UTC(2026, 1, d)).getUTCDay());
    const state = d < 11 ? 'delivered' : d >= 18 && d <= 21 ? 'paused' : 'planned';
    const qty = state === 'paused' ? 0 : weekend ? 3 : 2;
    days.push({ date, state, items: qty ? [{ variantId: 'tm', name: 'Toned Milk 500 ml', quantity: qty }] : [], editable: d >= 11 });
  }
  return { month: '2026-02', today: '2026-02-11', days };
}

export default async function Home() {
  const products = (await apiGet<{ data: ProductSummary[] }>('/v1/store/products'))?.data ?? [];
  const milk = products.filter((p) => p.category.slug === 'milk');
  const more = products.filter((p) => p.category.slug !== 'milk').slice(0, 4);
  const example = exampleMonth();

  return (
    <>
      <section className="mx-auto grid max-w-[1200px] gap-10 px-4 pb-16 pt-10 md:grid-cols-12 md:px-6 md:pt-16">
        <div className="md:col-span-7">
          <SectionLabel n="01">Tomorrow, 5–8 AM</SectionLabel>
          <h1 className="mt-6 font-display text-display tracking-tight">
            Milked at 3.
            <br />
            At your door by&nbsp;7.
          </h1>
          <p className="mt-6 max-w-[34rem] text-lg text-ink-2">
            Cow and buffalo milk from our herd in Mulshi, pasteurised and packed before dawn. Toned milk from{' '}
            <Money paise={2800} className="text-ink" /> for 500&nbsp;ml on subscription. Pause, skip or double any day until 10&nbsp;PM the night before.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link href="/products?category=milk" className="inline-flex h-14 items-center rounded-1 bg-signal px-6 text-lg font-medium text-on-signal hover:brightness-95">
              Start a milk subscription
            </Link>
            <Link href="/products" className="text-lg underline underline-offset-4">
              Order once
            </Link>
          </div>
          <dl className="mt-12 grid max-w-[34rem] grid-cols-3 gap-4 rule-t pt-6">
            {[
              ['3.0%', 'fat, toned'],
              ['2 days', 'fridge life'],
              ['₹0', 'delivery fee'],
            ].map(([value, label]) => (
              <div key={label}>
                <dt className="sr-only">{label}</dt>
                <dd className="num whitespace-nowrap text-xl md:text-2xl">{value}</dd>
                <dd className="text-sm text-ink-2">{label}</dd>
              </div>
            ))}
          </dl>
        </div>

        <figure className="md:col-span-5 md:pt-10">
          <div className="border border-rule bg-paper">
            <div className="flex items-baseline justify-between px-3 py-3 rule-b">
              <span className="font-display text-xl">February</span>
              <span className="text-sm text-ink-2">2 × Toned 500 ml, 3 on weekends</span>
            </div>
            <MilkCard month={example.month} today={example.today} days={example.days} />
          </div>
          <figcaption className="mt-3 text-sm text-ink-2">
            Example milk card. Ticks are delivered days, dashes a four-day pause, the marigold square is the next day you can still change.
          </figcaption>
        </figure>
      </section>

      <section className="mx-auto max-w-[1200px] px-4 py-12 md:px-6">
        <div className="flex items-end justify-between rule-b pb-4">
          <SectionLabel n="02">Daily milk</SectionLabel>
          <Link href="/products?category=milk" className="text-base underline underline-offset-4">
            All milk
          </Link>
        </div>
        <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 md:gap-x-6">
          {milk.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>

      <section className="mx-auto grid max-w-[1200px] gap-10 px-4 py-12 md:grid-cols-12 md:px-6">
        <div className="md:col-span-5">
          <SectionLabel n="03">How paying works</SectionLabel>
          <h2 className="mt-6 font-display text-2xl">One wallet. A line for every delivery.</h2>
          <p className="mt-4 text-lg text-ink-2">
            Top up with UPI or a card. Each night at 10 PM we charge tomorrow&rsquo;s delivery and send you the line. If we miss a delivery, it comes back to your wallet the same morning.
          </p>
        </div>
        <div className="md:col-span-6 md:col-start-7">
          <div className="border border-rule bg-paper p-5">
            <div className="flex items-baseline justify-between rule-b pb-3">
              <span className="text-sm uppercase tracking-[0.12em] text-ink-2">Wallet</span>
              <Money paise={41800} className="text-2xl" />
            </div>
            <ul className="mt-3 space-y-2 text-base">
              {[
                ['12 Feb', 'Delivery · 2 × Toned 500 ml', -5600],
                ['11 Feb', 'Top-up · UPI', 50000],
                ['11 Feb', 'Delivery · 2 × Toned 500 ml', -5600],
                ['10 Feb', 'Refund · delivery missed', 5600],
              ].map(([date, label, amount]) => (
                <li key={`${date}${label}`} className="flex items-end">
                  <span className="num w-16 shrink-0 text-sm text-ink-2">{date}</span>
                  <span>{label}</span>
                  <span className="leaders" />
                  <Money paise={amount as number} signed className={(amount as number) > 0 ? 'text-tick' : ''} />
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {more.length > 0 && (
        <section className="mx-auto max-w-[1200px] px-4 py-12 md:px-6">
          <div className="flex items-end justify-between rule-b pb-4">
            <SectionLabel n="04">Add to tomorrow</SectionLabel>
            <Link href="/products" className="text-base underline underline-offset-4">
              Everything
            </Link>
          </div>
          <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4 md:gap-x-6">
            {more.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
