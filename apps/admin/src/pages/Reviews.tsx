import { useCallback, useEffect, useState } from 'react';
import { Btn, Empty, Page } from '../components/ui';
import { api, ApiError } from '../lib/api';
import { when } from '../lib/format';

interface Row {
  id: string;
  rating: number;
  title: string;
  body: string;
  author: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  product: { name: string; slug: string };
  customer: { name: string; email: string };
  orderNumber: string;
}
const TABS = [
  ['pending', 'Waiting'],
  ['approved', 'Published'],
  ['rejected', 'Rejected'],
] as const;

export function ReviewsPage({ permissions }: { permissions: string[] }) {
  const [status, setStatus] = useState<Row['status']>('pending');
  const [data, setData] = useState<{ data: Row[]; counts: Record<string, number> } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const canWrite = permissions.includes('catalog.write');
  const load = useCallback(() => api<{ data: Row[]; counts: Record<string, number> }>(`/v1/admin/reviews?status=${status}`).then(setData), [status]);
  useEffect(() => {
    void load();
  }, [load]);

  async function set(id: string, next: Row['status']) {
    setMsg(null);
    try {
      await api(`/v1/admin/reviews/${id}`, { method: 'PATCH', body: JSON.stringify({ status: next }) });
      await load();
    } catch (e) {
      setMsg(e instanceof ApiError ? (e.problem.detail ?? e.problem.title) : 'Failed');
    }
  }

  return (
    <Page title="Reviews" subtitle="Only customers with a delivered order can review. Approve real feedback, good or bad; reject spam or abuse.">
      <div className="flex gap-1">
        {TABS.map(([k, l]) => (
          <button key={k} type="button" onClick={() => setStatus(k)} className={`rounded-pill px-3 py-1.5 text-sm ${status === k ? 'bg-forest text-on-forest' : 'hover:bg-paper'}`}>
            {l} <span className="num ml-1 opacity-70">{data?.counts[k] ?? 0}</span>
          </button>
        ))}
      </div>
      {msg && <p role="alert" className="mt-3 text-alert">{msg}</p>}
      <ul className="mt-4 space-y-3">
        {data?.data.map((r) => (
          <li key={r.id} className="rounded-4 border border-rule bg-paper p-4 shadow-card">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-lg leading-none text-[#e3a008]" aria-label={`${r.rating} stars`}>
                  {'★'.repeat(r.rating)}
                  <span className="text-paper-3">{'★'.repeat(5 - r.rating)}</span>
                </p>
                {r.title && <p className="mt-2 font-semibold">{r.title}</p>}
                {r.body ? <p className="mt-1 max-w-2xl text-ink-2">{r.body}</p> : <p className="mt-1 text-sm text-ink-3">No text, rating only</p>}
                <p className="mt-2 text-xs text-ink-3">
                  {r.product.name} · shown as “{r.author}” · {r.customer.email} · order <span className="num">{r.orderNumber}</span> · {when(r.createdAt)}
                </p>
              </div>
              {canWrite && (
                <div className="flex gap-2">
                  {r.status !== 'approved' && <Btn variant="primary" onClick={() => set(r.id, 'approved')}>Publish</Btn>}
                  {r.status !== 'rejected' && <Btn variant="outline" onClick={() => set(r.id, 'rejected')}>Reject</Btn>}
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
      {data && data.data.length === 0 && <div className="mt-4"><Empty>{status === 'pending' ? 'No reviews waiting. New ones appear here after customers receive their orders.' : 'Nothing here.'}</Empty></div>}
    </Page>
  );
}
