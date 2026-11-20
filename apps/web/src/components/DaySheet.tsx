'use client';

import { Button, type MilkCardDay } from '@dairy/ui';
import { useEffect, useRef, useState } from 'react';
import { api, ApiError } from '@/lib/api-client';

interface Sub {
  id: string;
  items: { variantId: string; name: string }[];
}

const longDate = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });

/** Bottom sheet to change one day: quantity steppers, skip, or pause from this day. */
export function DaySheet({ day, subscriptions, onClose, onSaved }: { day: MilkCardDay; subscriptions: Sub[]; onClose: () => void; onSaved: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const sub = subscriptions[0];
  const initial = Object.fromEntries((sub?.items ?? []).map((i) => [i.variantId, day.items.find((d) => d.variantId === i.variantId)?.quantity ?? 0]));
  const [qty, setQty] = useState<Record<string, number>>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  async function save(items: { variantId: string; quantity: number }[]) {
    if (!sub) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/v1/store/subscriptions/${sub.id}/overrides/${day.date}`, { method: 'PUT', body: JSON.stringify({ items }) });
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? (e.problem.detail ?? e.problem.title) : 'Could not save. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="day-title"
      className="fixed inset-x-0 bottom-0 top-auto m-0 w-full max-w-none bg-paper p-0 text-ink shadow-float backdrop:bg-ink/40 md:inset-auto md:m-auto md:max-w-md md:rounded-2"
    >
      <div className="p-5">
        <div className="flex items-start justify-between">
          <h2 id="day-title" className="font-display text-xl">
            {longDate(day.date)}
          </h2>
          <button type="button" onClick={() => ref.current?.close()} aria-label="Close" className="h-9 w-9 text-xl">
            ×
          </button>
        </div>
        {!day.editable ? (
          <div className="mt-3 text-base text-ink-2">
            {day.items.length ? (
              <ul className="space-y-1 text-ink">
                {day.items.map((i) => (
                  <li key={i.variantId}>
                    <span className="num">{i.quantity}×</span> {i.name}
                  </li>
                ))}
              </ul>
            ) : (
              <p>No delivery.</p>
            )}
            <p className="mt-3">This day is locked. Changes apply from the next open day.</p>
          </div>
        ) : !sub ? (
          <p className="mt-3 text-ink-2">Start a subscription to plan deliveries.</p>
        ) : (
          <>
            <ul className="mt-4 rule-t">
              {sub.items.map((i) => (
                <li key={i.variantId} className="flex items-center justify-between py-3 rule-b">
                  <span>{i.name}</span>
                  <span className="flex items-center gap-3">
                    <button type="button" aria-label={`One less ${i.name}`} onClick={() => setQty((q) => ({ ...q, [i.variantId]: Math.max(0, (q[i.variantId] ?? 0) - 1) }))} className="h-10 w-10 rounded-1 border border-rule text-lg">
                      −
                    </button>
                    <span className="num w-6 text-center text-lg" aria-live="polite">
                      {qty[i.variantId] ?? 0}
                    </span>
                    <button type="button" aria-label={`One more ${i.name}`} onClick={() => setQty((q) => ({ ...q, [i.variantId]: Math.min(20, (q[i.variantId] ?? 0) + 1) }))} className="h-10 w-10 rounded-1 border border-rule text-lg">
                      +
                    </button>
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-5 flex gap-3">
              <Button variant="primary" className="flex-1" disabled={busy} onClick={() => save(Object.entries(qty).map(([variantId, quantity]) => ({ variantId, quantity })))}>
                Save for this day
              </Button>
              <Button variant="outline" disabled={busy} onClick={() => save([])}>
                Skip day
              </Button>
            </div>
          </>
        )}
        {error && (
          <p role="alert" className="mt-3 text-alert">
            {error}
          </p>
        )}
      </div>
    </dialog>
  );
}
