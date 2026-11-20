'use client';

import { Button, Money, MilkCard, type MilkCardDay } from '@dairy/ui';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api-client';
import { DaySheet } from './DaySheet';
import { Onboarding } from './Onboarding';

interface Me {
  id: string;
  name: string;
  phone: string | null;
  defaultAddressId: string | null;
  profileComplete: boolean;
}
interface Calendar {
  month: string;
  today: string;
  days: (MilkCardDay & { charge: { amount: number } | null; estimatedCharge: { amount: number } | null })[];
  totals: { deliveredDays: number; units: number; spent: { amount: number } };
}
interface Wallet {
  balance: { amount: number };
  projected: { next7Days: { amount: number }; runsOutOn: string | null };
  lowBalance: boolean;
}
interface Subscription {
  id: string;
  status: string;
  pattern: string;
  items: { variantId: string; name: string; quantity?: number; weekdayQuantities?: number[]; unitPrice: { amount: number } }[];
  estimatedMonthly: { amount: number };
  nextDelivery: { date: string } | null;
}

const monthLabel = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const shiftMonth = (m: string, delta: number) => {
  const d = new Date(`${m}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + delta);
  return d.toISOString().slice(0, 7);
};
const shortDate = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

export function AccountView() {
  const router = useRouter();
  const params = useSearchParams();
  const [me, setMe] = useState<Me | null | 'signed-out'>(null);
  const [month, setMonth] = useState<string | null>(null);
  const [calendar, setCalendar] = useState<Calendar | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [selected, setSelected] = useState<MilkCardDay | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (m?: string) => {
    try {
      const profile = await api<Me>('/v1/store/me');
      setMe(profile);
      if (!profile.profileComplete) return;
      const target = m ?? month ?? new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 7);
      const [cal, w, s] = await Promise.all([
        api<Calendar>(`/v1/store/calendar?month=${target}`),
        api<Wallet>('/v1/store/wallet'),
        api<{ data: Subscription[] }>('/v1/store/subscriptions?status=active'),
      ]);
      setMonth(target);
      setCalendar(cal);
      setWallet(w);
      setSubs(s.data);
    } catch (e) {
      if (e instanceof ApiError && e.problem.status === 401) setMe('signed-out');
      else setError(e instanceof ApiError ? (e.problem.detail ?? e.problem.title) : 'Could not load your account.');
    }
  }, [month]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (me === null) return <div className="mx-auto max-w-[1200px] px-4 py-16 text-ink-2 md:px-6">Loading your milk card…</div>;
  if (me === 'signed-out') {
    return (
      <div className="mx-auto max-w-[1200px] px-4 py-16 md:px-6">
        <h1 className="font-display text-2xl">Your milk card lives here</h1>
        <p className="mt-3 max-w-md text-lg text-ink-2">Sign in to see tomorrow&rsquo;s delivery, pause for a holiday or top up your wallet.</p>
        <Link href="/signin?next=/account" className="mt-6 inline-flex h-12 items-center rounded-1 bg-ink px-5 text-paper">
          Sign in with Google
        </Link>
      </div>
    );
  }
  if (!me.profileComplete || params.get('setup')) {
    return (
      <Onboarding
        me={me}
        onDone={() => {
          const next = params.get('next');
          if (next) router.push(next);
          else void load();
        }}
      />
    );
  }

  const nextDay = calendar?.days.find((d) => d.editable);
  return (
    <div className="mx-auto max-w-[1200px] px-4 py-10 md:px-6">
      {params.get('subscribed') && (
        <p role="status" className="mb-6 border-l-4 border-tick bg-paper-2 px-4 py-3">
          Subscription started. Your first delivery is on the marigold square below.
        </p>
      )}
      <div className="grid gap-10 md:grid-cols-12">
        <section className="md:col-span-8" aria-labelledby="card-title">
          <div className="flex items-end justify-between rule-b pb-3">
            <h1 id="card-title" className="font-display text-2xl">
              {month ? monthLabel(month) : 'Milk card'}
            </h1>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" aria-label="Previous month" onClick={() => month && load(shiftMonth(month, -1))}>
                ←
              </Button>
              <Button variant="outline" size="sm" aria-label="Next month" onClick={() => month && load(shiftMonth(month, 1))}>
                →
              </Button>
            </div>
          </div>
          {calendar && <MilkCard month={calendar.month} today={calendar.today} days={calendar.days} onSelect={(d) => setSelected(d)} />}
          {nextDay?.cutoffAt && (
            <p className="mt-3 text-base text-ink-2">
              Change {shortDate(nextDay.date)} until{' '}
              <span className="num text-ink">{new Date(nextDay.cutoffAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' })}</span>{' '}
              the night before.
            </p>
          )}
          {subs.length === 0 && (
            <p className="mt-6 text-lg">
              No subscription yet.{' '}
              <Link href="/products?category=milk" className="underline underline-offset-4">
                Choose your milk
              </Link>
              .
            </p>
          )}
        </section>

        <aside className="space-y-8 md:col-span-4">
          {wallet && (
            <section aria-labelledby="wallet-title" className="border border-rule p-5">
              <div className="flex items-baseline justify-between">
                <h2 id="wallet-title" className="text-sm uppercase tracking-[0.12em] text-ink-2">
                  Wallet
                </h2>
                <Money paise={wallet.balance.amount} className={`text-2xl ${wallet.lowBalance ? 'text-alert' : ''}`} />
              </div>
              <p className="mt-3 text-base text-ink-2">
                Next 7 days: <Money paise={wallet.projected.next7Days.amount} className="text-ink" />
                {wallet.projected.runsOutOn && (
                  <>
                    <br />
                    Runs out around <span className="text-ink">{shortDate(wallet.projected.runsOutOn)}</span>
                  </>
                )}
              </p>
            </section>
          )}
          {subs.map((s) => (
            <section key={s.id} className="border border-rule p-5">
              <h2 className="text-sm uppercase tracking-[0.12em] text-ink-2">{s.pattern === 'daily' ? 'Every day' : s.pattern === 'alternate' ? 'Every other day' : 'Chosen weekdays'}</h2>
              <ul className="mt-2 space-y-1">
                {s.items.map((i) => (
                  <li key={i.variantId} className="flex items-end">
                    <span>
                      <span className="num">{i.quantity ?? '—'}×</span> {i.name}
                    </span>
                    <span className="leaders" />
                    <Money paise={i.unitPrice.amount} />
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-sm text-ink-2">
                About <Money paise={s.estimatedMonthly.amount} className="text-ink" /> a month
                {s.nextDelivery && <> · next {shortDate(s.nextDelivery.date)}</>}
              </p>
            </section>
          ))}
          {calendar && (
            <p className="text-sm text-ink-2">
              This month: <span className="num text-ink">{calendar.totals.deliveredDays}</span> deliveries, <span className="num text-ink">{calendar.totals.units}</span> packs,{' '}
              <Money paise={calendar.totals.spent.amount} className="text-ink" />.
            </p>
          )}
        </aside>
      </div>
      {error && (
        <p role="alert" className="mt-6 text-alert">
          {error}
        </p>
      )}
      {selected && <DaySheet day={selected} subscriptions={subs} onClose={() => setSelected(null)} onSaved={() => { setSelected(null); void load(month ?? undefined); }} />}
    </div>
  );
}
