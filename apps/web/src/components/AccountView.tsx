'use client';

import { Money, PackShot } from '@dairy/ui';
import { motion } from 'motion/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api-client';
import { shortDate, STATUS_LABEL } from '@/lib/format';
import type { Address, Pack } from '@/lib/types';
import { AddressForm } from './AddressForm';

interface OrderRow {
  id: string;
  number: string;
  status: string;
  placedAt: string;
  total: { amount: number };
  itemCount: number;
  firstItem: string;
  packs: Pack[];
}

const tone: Record<string, string> = {
  pending_payment: 'bg-signal/30',
  confirmed: 'bg-meadow',
  packed: 'bg-meadow',
  shipped: 'bg-meadow',
  delivered: 'bg-forest text-on-forest',
  cancelled: 'bg-paper-3',
  refunded: 'bg-paper-3',
};

export function AccountView() {
  const router = useRouter();
  const [me, setMe] = useState<{ name: string; email: string } | null | 'signed-out'>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    api<{ name: string; email: string }>('/v1/store/me')
      .then(async (m) => {
        setMe(m);
        const [o, a] = await Promise.all([api<{ data: OrderRow[] }>('/v1/store/orders'), api<{ data: Address[] }>('/v1/store/me/addresses')]);
        setOrders(o.data);
        setAddresses(a.data);
      })
      .catch((e) => setMe(e instanceof ApiError && e.problem.status === 401 ? 'signed-out' : null));
  }, []);

  if (me === null) return <div className="mx-auto max-w-[1100px] px-4 py-24 text-ink-2">Loading…</div>;
  if (me === 'signed-out')
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <h1 className="font-extrabold tracking-[-0.02em] text-4xl">Your orders live here</h1>
        <p className="mt-3 text-lg text-ink-2">Sign in to track deliveries, cancel before packing and manage addresses.</p>
        <Link href="/signin?next=/account" className="mt-6 inline-block bg-forest px-6 py-3 text-on-forest rounded-pill">
          Sign in
        </Link>
      </div>
    );

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-10 md:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.14em] text-ink-2">Account</p>
          <h1 className="font-extrabold tracking-[-0.02em] text-[clamp(36px,5vw,56px)] leading-none">Namaste, {me.name.split(' ')[0]}</h1>
          <p className="mt-2 text-ink-2">{me.email}</p>
        </div>
        <button
          type="button"
          onClick={async () => {
            await api('/v1/auth/logout', { method: 'POST' }).catch(() => undefined);
            router.push('/');
            router.refresh();
          }}
          className="border border-rule px-5 py-2.5 hover:bg-paper-2 rounded-pill"
        >
          Sign out
        </button>
      </div>

      <section className="mt-10">
        <h2 className="text-xl font-bold">Orders</h2>
        {orders.length === 0 ? (
          <p className="mt-3 text-ink-2">
            No orders yet. <Link href="/products" className="underline">Start with a jar of ghee</Link>.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {orders.map((o, i) => (
              <motion.li key={o.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                <Link href={`/orders/${o.id}`} className="flex items-center gap-4 bg-paper-2 p-4 transition-colors hover:bg-paper-3 rounded-4">
                  <div className="flex -space-x-5">
                    {o.packs.map((p, j) => (
                      <PackShot key={j} kind={p.kind} color={p.color} accent={p.accent} label="" className="h-14 w-10" />
                    ))}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate">
                      {o.firstItem}
                      {o.itemCount > 1 && <span className="text-ink-2"> + {o.itemCount - 1} more</span>}
                    </p>
                    <p className="num text-sm text-ink-2">
                      {o.number} · {shortDate(o.placedAt)}
                    </p>
                  </div>
                  <span className={`hidden rounded-pill px-3 py-1 text-sm font-semibold sm:inline ${tone[o.status] ?? ''}`}>{STATUS_LABEL[o.status]}</span>
                  <Money paise={o.total.amount} />
                </Link>
              </motion.li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-12">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">Addresses</h2>
          {!adding && (
            <button type="button" onClick={() => setAdding(true)} className="text-forest underline underline-offset-4">
              + Add address
            </button>
          )}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {addresses.map((a) => (
            <div key={a.id} className="border border-rule bg-paper p-4 rounded-4">
              <p>
                {a.name} {a.isDefault && <span className="ml-2 bg-meadow px-2 py-0.5 text-xs rounded-4">Default</span>}
              </p>
              <p className="text-sm text-ink-2">{[a.line1, a.line2, a.city, a.state].filter(Boolean).join(', ')} – <span className="num">{a.pincode}</span></p>
              <p className="num text-sm text-ink-2">{a.phone}</p>
            </div>
          ))}
        </div>
        {adding && (
          <div className="mt-4 bg-paper-2 p-5 rounded-4">
            <AddressForm defaultName={me.name} onCancel={() => setAdding(false)} onSaved={(a) => { setAddresses((l) => [...l.map((x) => ({ ...x, isDefault: false })), a]); setAdding(false); }} />
          </div>
        )}
      </section>

      <p className="mt-12 text-sm text-ink-2">
        <Link href="/account/delete" className="underline">Delete my account</Link>
      </p>
    </div>
  );
}
