import { PackShot } from '@dairy/ui';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Btn, Card, Empty, Field, Page, StatusBadge, input, td, th } from '../components/ui';
import { api, ApiError, download } from '../lib/api';
import { printPackingSlips } from '../lib/packing-slip';
import { STATUS, rupees, when, type Money } from '../lib/format';

interface Row {
  id: string;
  number: string;
  status: string;
  placedAt: string;
  customer: string;
  phone: string;
  city: string;
  pincode: string;
  zone: string;
  items: number;
  firstItem: string;
  total: Money;
  courier: string | null;
  trackingNumber: string | null;
}

const TABS = ['', 'confirmed', 'packed', 'shipped', 'delivered', 'pending_payment', 'cancelled'];

export function OrdersPage({ status: initial, permissions = [] }: { status?: string; permissions?: string[] }) {
  const [status, setStatus] = useState(initial ?? '');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const canFulfil = permissions.includes('orders.fulfil');
  const [q, setQ] = useState('');
  const [data, setData] = useState<{ data: Row[]; counts: Record<string, number> } | null>(null);
  const load = useCallback(() => {
    const qs = new URLSearchParams({ ...(status ? { status } : {}), ...(q ? { q } : {}), limit: '50' });
    return api<{ data: Row[]; counts: Record<string, number> }>(`/v1/admin/orders?${qs}`).then(setData);
  }, [status, q]);
  useEffect(() => {
    const t = setTimeout(load, q ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  const total = data ? Object.values(data.counts).reduce((a, b) => a + b, 0) : 0;
  const rows = data?.data ?? [];
  const toggle = (id: string) =>
    setSelected((s0) => {
      const s1 = new Set(s0);
      if (s1.has(id)) s1.delete(id);
      else s1.add(id);
      return s1;
    });
  const allOn = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const picked = rows.filter((r) => selected.has(r.id));

  async function bulkPack() {
    setBusy(true);
    setNote(null);
    try {
      const r = await api<{ packed: string[]; failed: { id: string; reason: string }[] }>('/v1/admin/orders/bulk/pack', {
        method: 'POST',
        body: JSON.stringify({ orderIds: picked.map((o) => o.id) }),
      });
      setNote(`${r.packed.length} marked packed${r.failed.length ? `, ${r.failed.length} skipped (not in “Paid” status)` : ''}.`);
      setSelected(new Set());
      await load();
    } catch (e) {
      setNote(e instanceof ApiError ? (e.problem.detail ?? e.problem.title) : 'Failed');
    } finally {
      setBusy(false);
    }
  }
  async function slips() {
    const r = await api<{ data: SlipOrder[] }>('/v1/admin/orders/packing-slips', { method: 'POST', body: JSON.stringify({ orderIds: picked.map((o) => o.id) }) });
    printPackingSlips(r.data);
  }

  return (
    <Page
      title="Orders"
      subtitle="Pack, ship and track every order."
      actions={
        <Btn variant="outline" onClick={() => download(`/v1/admin/orders/export.csv${status ? `?status=${status}` : ''}`, 'orders.csv').catch(() => setNote('Export failed'))}>
          Export CSV
        </Btn>
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1">
          {TABS.map((t) => (
            <button key={t} type="button" onClick={() => setStatus(t)} className={`rounded-pill px-3 py-1.5 text-sm ${status === t ? 'bg-forest text-on-forest' : 'hover:bg-paper-2'}`}>
              {t ? STATUS[t] : 'All'} <span className="num ml-1 font-semibold">{t ? (data?.counts[t] ?? 0) : total}</span>
            </button>
          ))}
        </div>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search number, name, phone, pincode, AWB" aria-label="Search orders" className={`${input} max-w-xs`} />
      </div>
      {picked.length > 0 && (
        <div className="sticky top-0 z-10 mt-4 flex flex-wrap items-center gap-2 rounded-3 bg-forest px-4 py-2 text-on-forest">
          <span className="num mr-2">{picked.length} selected</span>
          <Btn variant="primary" onClick={slips}>
            Print packing slips
          </Btn>
          {canFulfil && (
            <Btn variant="primary" disabled={busy} onClick={bulkPack}>
              Mark packed
            </Btn>
          )}
          <button type="button" className="ml-auto text-sm underline" onClick={() => setSelected(new Set())}>
            Clear
          </button>
        </div>
      )}
      {note && (
        <p role="status" className="mt-3 text-sm text-ink-2">
          {note}
        </p>
      )}
      <div tabIndex={0} className="mt-4 overflow-x-auto rounded-4 border border-rule bg-paper">
        <table className="w-full min-w-[820px]">
          <thead>
            <tr className="rule-b">
              <th className={`${th} w-10`}>
                <input
                  type="checkbox"
                  aria-label="Select all orders on this page"
                  checked={allOn}
                  onChange={() => setSelected(allOn ? new Set() : new Set(rows.map((r) => r.id)))}
                  className="accent-[var(--forest)]"
                />
              </th>
              <th className={th}>Order</th>
              <th className={th}>Customer</th>
              <th className={th}>Items</th>
              <th className={th}>Ship to</th>
              <th className={th}>Status</th>
              <th className={`${th} text-right`}>Total</th>
            </tr>
          </thead>
          <tbody>
            {data?.data.map((o) => (
              <tr key={o.id} onClick={() => (location.hash = `#/orders/${o.id}`)} className={`cursor-pointer rule-b hover:bg-paper-2 ${selected.has(o.id) ? 'bg-meadow/20' : ''}`}>
                <td className={td} onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" aria-label={`Select order ${o.number}`} checked={selected.has(o.id)} onChange={() => toggle(o.id)} className="accent-[var(--forest)]" />
                </td>
                <td className={td}>
                  <span className="num">{o.number}</span>
                  <span className="block text-xs text-ink-2">{when(o.placedAt)}</span>
                </td>
                <td className={td}>
                  {o.customer}
                  <span className="num block text-xs text-ink-2">{o.phone}</span>
                </td>
                <td className={td}>
                  {o.firstItem}
                  {o.items > 1 && <span className="text-ink-2"> +{o.items - 1}</span>}
                </td>
                <td className={td}>
                  {o.city} <span className="num text-ink-2">{o.pincode}</span>
                  {o.trackingNumber && (
                    <span className="num block text-xs text-ink-2">
                      {o.courier} · {o.trackingNumber}
                    </span>
                  )}
                </td>
                <td className={td}>
                  <StatusBadge status={o.status} />
                </td>
                <td className={`${td} num text-right`}>{rupees(o.total.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {data && data.data.length === 0 && (
          <div className="p-4">
            <Empty>No orders here.</Empty>
          </div>
        )}
      </div>
    </Page>
  );
}

export type SlipOrder = Pick<Detail, 'number' | 'placedAt' | 'items' | 'shippingAddress' | 'delivery' | 'total' | 'note'>;

interface Detail {
  id: string;
  number: string;
  status: string;
  placedAt: string;
  items: { id: string; name: string; sku: string; packSize: string; pack: { kind: string; color: string; accent: string }; quantity: number; unitPrice: Money; total: Money }[];
  subtotal: Money;
  shipping: Money;
  taxIncluded: Money;
  total: Money;
  shippingAddress: {
    name: string;
    phone: string;
    line1: string;
    line2: string | null;
    landmark: string | null;
    city: string;
    state: string;
    pincode: string;
    location?: { lat: number; lng: number; accuracyM: number | null; source: string; directionsUrl: string } | null;
  };
  delivery: { zone: string; etaMinDays: number; etaMaxDays: number; courier: string | null; trackingNumber: string | null; trackingUrl: string | null };
  payment: { id: string; provider: string; status: string; method: string | null } | null;
  refunds: { id: string; amount: Money; status: string; reason: string }[];
  events: { type: string; from: string | null; to: string | null; actorType: string; at: string; data: Record<string, unknown> }[];
  cancelReason: string | null;
  customer: { id: string; name: string; email: string; phone: string | null } | null;
  emails?: { template: string; status: string; attempts: number; lastError: string | null; sentAt: string | null }[];
  note: string | null;
}

export function OrderDetailPage({ id, permissions }: { id: string; permissions: string[] }) {
  const [o, setO] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api<Detail>(`/v1/admin/orders/${id}`)
      .then(setO)
      .catch((e) => setError(e instanceof ApiError ? (e.problem.detail ?? e.problem.title) : 'Not found'));
  }, [id]);

  async function act(path: string, body?: unknown) {
    setBusy(true);
    setError(null);
    try {
      await api(`/v1/admin/orders/${id}/${path}`, { method: 'POST', body: body ? JSON.stringify(body) : undefined });
      setO(await api<Detail>(`/v1/admin/orders/${id}`));
    } catch (e) {
      setError(e instanceof ApiError ? (e.problem.detail ?? e.problem.title) : 'Action failed');
    } finally {
      setBusy(false);
    }
  }
  function ship(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    void act('ship', { courier: f.get('courier'), trackingNumber: f.get('trackingNumber'), ...(f.get('trackingUrl') ? { trackingUrl: f.get('trackingUrl') } : {}) });
  }

  if (!o) return <Page title="Order">{error ? <p className="text-alert">{error}</p> : <p className="text-ink-2">Loading…</p>}</Page>;
  const a = o.shippingAddress;
  const can = (p: string) => permissions.includes(p);

  return (
    <Page
      title={`Order ${o.number}`}
      subtitle={
        <span className="flex items-center gap-2">
          Placed {when(o.placedAt)} <StatusBadge status={o.status} />
        </span>
      }
      actions={
        <Btn variant="outline" onClick={() => history.back()}>
          ← Back
        </Btn>
      }
    >
      {error && (
        <p role="alert" className="mb-4 rounded-3 bg-paper-2 p-3 text-alert">
          {error}
        </p>
      )}
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Card title="Items">
            <ul className="divide-y divide-rule">
              {o.items.map((i) => (
                <li key={i.id} className="flex items-center gap-3 py-2">
                  <PackShot kind={i.pack.kind} color={i.pack.color} accent={i.pack.accent} label={i.name} className="h-12 w-9" />
                  <span className="flex-1">
                    {i.name} <span className="text-ink-2">{i.packSize}</span>
                    <span className="num block text-xs text-ink-2">{i.sku}</span>
                  </span>
                  <span className="num text-lg">{i.quantity}×</span>
                  <span className="num w-24 text-right">{rupees(i.total.amount)}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <dt className="text-ink-2">Subtotal</dt>
                <dd className="num">{rupees(o.subtotal.amount)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-2">Shipping ({o.delivery.zone})</dt>
                <dd className="num">{o.shipping.amount ? rupees(o.shipping.amount) : 'Free'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-2">GST included</dt>
                <dd className="num">{rupees(o.taxIncluded.amount)}</dd>
              </div>
              <div className="flex justify-between text-base">
                <dt>Total</dt>
                <dd className="num">{rupees(o.total.amount)}</dd>
              </div>
            </dl>
          </Card>

          <Card title="Fulfilment">
            {o.status === 'confirmed' && can('orders.fulfil') && (
              <div className="flex items-center justify-between gap-3">
                <p>Paid. Pick the items above, pack them, then mark packed.</p>
                <Btn variant="primary" disabled={busy} onClick={() => act('pack')}>
                  Mark packed
                </Btn>
              </div>
            )}
            {o.status === 'packed' && can('orders.fulfil') && (
              <form onSubmit={ship} className="grid gap-3 sm:grid-cols-3">
                <Field label="Courier">
                  <input name="courier" required defaultValue="Delhivery" className={input} />
                </Field>
                <Field label="Tracking number (AWB)">
                  <input name="trackingNumber" required className={`${input} num`} />
                </Field>
                <Field label="Tracking link (optional)">
                  <input name="trackingUrl" type="url" className={input} />
                </Field>
                <div className="sm:col-span-3">
                  <Btn type="submit" variant="primary" disabled={busy}>
                    Hand over to courier
                  </Btn>
                </div>
              </form>
            )}
            {o.status === 'shipped' && (
              <div className="flex items-center justify-between gap-3">
                <p>
                  With {o.delivery.courier} · <span className="num">{o.delivery.trackingNumber}</span>
                </p>
                {can('orders.fulfil') && (
                  <Btn disabled={busy} onClick={() => act('deliver')}>
                    Mark delivered
                  </Btn>
                )}
              </div>
            )}
            {o.status === 'delivered' && (
              <p>
                Delivered by {o.delivery.courier} · <span className="num">{o.delivery.trackingNumber}</span>
              </p>
            )}
            {o.status === 'pending_payment' && <p className="text-ink-2">Waiting for the customer to pay. Unpaid orders close automatically and release their stock.</p>}
            {o.status === 'cancelled' && <p className="text-ink-2">Cancelled: {o.cancelReason}</p>}
            {['pending_payment', 'confirmed', 'packed'].includes(o.status) && can('orders.refund') && (
              <div className="mt-4 rule-t pt-3">
                <Btn
                  variant="danger"
                  disabled={busy}
                  onClick={() => {
                    const reason = prompt('Why is this order being cancelled? The customer sees this and is refunded in full.');
                    if (reason && reason.trim().length >= 3) void act('cancel', { reason: reason.trim() });
                  }}
                >
                  Cancel and refund
                </Btn>
              </div>
            )}
          </Card>

          <Card title="History">
            <ol className="space-y-2">
              {o.events.map((e, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span className="num w-40 shrink-0 whitespace-nowrap text-ink-2">{when(e.at)}</span>
                  <span>
                    <span className="capitalize">{e.type}</span>
                    {e.to && <span className="text-ink-2"> → {STATUS[e.to] ?? e.to}</span>}
                    <span className="text-ink-3"> by {e.actorType}</span>
                  </span>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Ship to">
            <p>{a.name}</p>
            <p className="text-ink-2">{[a.line1, a.line2, a.landmark].filter(Boolean).join(', ')}</p>
            <p className="text-ink-2">
              {a.city}, {a.state} <span className="num">{a.pincode}</span>
            </p>
            <p className="num mt-1">{a.phone}</p>
            {a.location ? (
              <a
                href={a.location.directionsUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-3 flex items-center justify-between gap-2 rounded-3 bg-meadow px-3 py-2 text-sm font-semibold text-forest hover:underline"
              >
                <span>📍 Open exact location in Google Maps</span>
                <span className="text-xs font-normal text-ink-2">{a.location.source === 'device' ? `GPS${a.location.accuracyM ? ` ±${a.location.accuracyM} m` : ''}` : 'map pin'}</span>
              </a>
            ) : (
              <p className="mt-3 rounded-3 bg-paper-2 px-3 py-2 text-xs text-ink-2">No map pin. Use the address and landmark.</p>
            )}
            <p className="mt-2 text-xs text-ink-2">
              Promised {o.delivery.etaMinDays}–{o.delivery.etaMaxDays} days after dispatch
            </p>
          </Card>
          {o.customer && (
            <Card
              title="Customer"
              action={
                <Btn variant="ghost" onClick={() => (location.hash = `#/customers/${o.customer!.id}`)}>
                  Profile →
                </Btn>
              }
            >
              <p>{o.customer.name}</p>
              <p className="text-ink-2">{o.customer.email}</p>
            </Card>
          )}
          <Card title="Payment">
            {o.payment ? (
              <>
                <p className="capitalize">
                  {o.payment.status} · {o.payment.provider}
                  {o.payment.method && ` · ${o.payment.method.toUpperCase()}`}
                </p>
                <p className="num text-xs text-ink-2">{o.payment.id}</p>
              </>
            ) : (
              <p className="text-ink-2">No payment</p>
            )}
            {o.refunds.map((r) => (
              <p key={r.id} className="mt-2 text-sm">
                Refund <span className="num">{rupees(r.amount.amount)}</span> · {r.status}
                <span className="block text-xs text-ink-2">{r.reason}</span>
              </p>
            ))}
          </Card>
          {o.emails && o.emails.length > 0 && (
            <Card title="Emails to the customer">
              <ul className="space-y-1 text-sm">
                {o.emails.map((e, i) => (
                  <li key={i} className="flex items-baseline justify-between gap-3">
                    <span>
                      {({ order_confirmed: 'Order confirmed', order_shipped: 'Shipped', order_delivered: 'Delivered', order_cancelled: 'Cancelled' } as Record<string, string>)[e.template] ??
                        e.template}
                    </span>
                    <span className={e.status === 'sent' ? 'text-forest' : e.status === 'failed' ? 'text-alert' : 'text-ink-2'}>
                      {e.status === 'sent' ? `sent ${e.sentAt ? when(e.sentAt) : ''}` : e.status === 'failed' ? `failed: ${e.lastError ?? ''}` : 'waiting to send'}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {o.note && (
            <Card title="Customer note">
              <p>{o.note}</p>
            </Card>
          )}
        </div>
      </div>
    </Page>
  );
}
