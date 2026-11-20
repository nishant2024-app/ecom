'use client';

import { Button, Money, cn } from '@dairy/ui';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api, ApiError } from '@/lib/api-client';
import type { Variant } from '@/lib/types';

type Pattern = 'daily' | 'alternate';

export function SubscribeBox({ slug, variants }: { slug: string; variants: Variant[] }) {
  const router = useRouter();
  const [variantId, setVariantId] = useState(variants[0]?.id ?? '');
  const [quantity, setQuantity] = useState(1);
  const [pattern, setPattern] = useState<Pattern>('daily');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const variant = variants.find((v) => v.id === variantId)!;
  const unit = variant.subscriptionPrice?.amount ?? variant.price.amount;
  const perMonth = unit * quantity * (pattern === 'daily' ? 30 : 15);

  async function subscribe() {
    setBusy(true);
    setError(null);
    try {
      const me = await api<{ phone: string | null; defaultAddressId: string | null }>('/v1/store/me').catch((e) => {
        if (e instanceof ApiError && e.problem.status === 401) {
          router.push(`/signin?next=/p/${slug}`);
          return null;
        }
        throw e;
      });
      if (!me) return;
      if (!me.phone || !me.defaultAddressId) {
        router.push(`/account?setup=1&next=/p/${slug}`);
        return;
      }
      const { data: addresses } = await api<{ data: { id: string; zoneId: string; isDefault: boolean }[] }>('/v1/store/me/addresses');
      const address = addresses.find((a) => a.isDefault) ?? addresses[0]!;
      const { data: slots } = await api<{ data: { id: string; dates: { date: string; open: boolean }[] }[] }>(`/v1/store/delivery-slots?zoneId=${address.zoneId}`);
      const slot = slots[0]!;
      const startsOn = slot.dates.find((d) => d.open)!.date;
      await api('/v1/store/subscriptions', {
        method: 'POST',
        idempotencyKey: crypto.randomUUID(),
        body: JSON.stringify({ addressId: address.id, slotId: slot.id, pattern, startsOn, items: [{ variantId, quantity }] }),
      });
      router.push('/account?subscribed=1');
    } catch (e) {
      setError(e instanceof ApiError ? (e.problem.detail ?? e.problem.title) : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-8 border border-ink p-5">
      <fieldset>
        <legend className="text-sm uppercase tracking-[0.12em] text-ink-2">Pack</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {variants.map((v) => (
            <label
              key={v.id}
              className={cn(
                'flex cursor-pointer items-center gap-3 rounded-1 border px-4 py-2.5',
                v.id === variantId ? 'border-ink bg-paper-2' : 'border-rule hover:border-ink',
              )}
            >
              <input type="radio" name="variant" value={v.id} checked={v.id === variantId} onChange={() => setVariantId(v.id)} className="sr-only" />
              <span>{v.packSize}</span>
              <Money paise={v.price.amount} className="text-ink-2" />
            </label>
          ))}
        </div>
      </fieldset>

      {variant.subscribable ? (
        <>
          <div className="mt-5 grid grid-cols-2 gap-4">
            <fieldset>
              <legend className="text-sm uppercase tracking-[0.12em] text-ink-2">Every</legend>
              <div className="mt-2 flex rounded-1 border border-rule">
                {(['daily', 'alternate'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    aria-pressed={pattern === p}
                    onClick={() => setPattern(p)}
                    className={cn('h-11 flex-1 text-base', pattern === p ? 'bg-ink text-paper' : 'hover:bg-paper-2')}
                  >
                    {p === 'daily' ? 'Day' : 'Other day'}
                  </button>
                ))}
              </div>
            </fieldset>
            <div>
              <span id="qty-label" className="text-sm uppercase tracking-[0.12em] text-ink-2">
                Quantity
              </span>
              <div role="group" aria-labelledby="qty-label" className="mt-2 flex h-11 items-center justify-between rounded-1 border border-rule">
                <button type="button" aria-label="One less" onClick={() => setQuantity((q) => Math.max(1, q - 1))} className="h-full w-11 text-xl hover:bg-paper-2">
                  −
                </button>
                <span className="num text-lg" aria-live="polite">
                  {quantity}
                </span>
                <button type="button" aria-label="One more" onClick={() => setQuantity((q) => Math.min(20, q + 1))} className="h-full w-11 text-xl hover:bg-paper-2">
                  +
                </button>
              </div>
            </div>
          </div>
          <div className="mt-5 flex items-end justify-between rule-t pt-4">
            <span className="text-ink-2">
              <Money paise={unit} /> each on subscription
            </span>
            <span className="text-right">
              <Money paise={perMonth} className="text-xl" />
              <span className="block text-xs text-ink-2">about a month</span>
            </span>
          </div>
          <Button variant="primary" size="lg" className="mt-4 w-full" onClick={subscribe} disabled={busy}>
            {busy ? 'Setting up…' : 'Subscribe from tomorrow'}
          </Button>
          <p className="mt-2 text-sm text-ink-2">Change or pause any day until 10 PM the night before.</p>
        </>
      ) : (
        <p className="mt-5 text-ink-2">One-time orders for this product open with wallet checkout.</p>
      )}
      {error && (
        <p role="alert" className="mt-3 text-alert">
          {error}
        </p>
      )}
    </div>
  );
}
