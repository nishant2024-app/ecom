'use client';

import { Money } from '@dairy/ui';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api-client';

/** Stand-in for Cashfree checkout when the API runs with the mock payment provider (development only). */
export function MockPay({ paymentId }: { paymentId: string }) {
  const router = useRouter();
  const [p, setP] = useState<{ orderId: string; orderNumber: string; amount: { amount: number }; status: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api<typeof p>(`/v1/dev/payments/${paymentId}`).then(setP).catch((e) => setError(e instanceof ApiError ? (e.problem.detail ?? e.problem.title) : 'Payment not found'));
  }, [paymentId]);

  async function finish(outcome: 'success' | 'failed') {
    setBusy(true);
    try {
      const r = await api<{ orderId: string }>(`/v1/dev/payments/${paymentId}/simulate`, { method: 'POST', body: JSON.stringify({ outcome, method: 'upi' }) });
      router.push(`/orders/${r.orderId}${outcome === 'success' ? '?placed=1' : ''}`);
    } catch (e) {
      setError(e instanceof ApiError ? (e.problem.detail ?? e.problem.title) : 'Could not complete');
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="border border-rule bg-paper p-6 shadow-card rounded-4">
        <p className="bg-signal/30 px-3 py-1 text-center text-sm">Test mode: no money moves. Cashfree checkout appears here in production.</p>
        {error && <p className="mt-4 text-alert">{error}</p>}
        {p && (
          <>
            <p className="mt-6 text-sm text-ink-2">Order {p.orderNumber}</p>
            <p className="mt-1">
              <Money paise={p.amount.amount} className="text-5xl" />
            </p>
            <div className="mt-8 grid gap-3">
              <button type="button" disabled={busy || p.status !== 'created'} onClick={() => finish('success')} className="h-14 bg-forest text-lg text-on-forest disabled:opacity-50 rounded-pill">
                Pay with test UPI
              </button>
              <button type="button" disabled={busy || p.status !== 'created'} onClick={() => finish('failed')} className="h-12 border border-rule">
                Simulate a failed payment
              </button>
            </div>
            {p.status !== 'created' && <p className="mt-4 text-sm text-ink-2">This payment is already {p.status}.</p>}
          </>
        )}
      </div>
    </div>
  );
}
