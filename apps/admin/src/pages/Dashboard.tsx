import { useEffect, useState } from 'react';
import { RevenueChart } from '../components/RevenueChart';
import { Btn, Card, Page, StatusBadge, td, th } from '../components/ui';
import { api } from '../lib/api';
import { day, rupees, when, type Money } from '../lib/format';

interface Dashboard {
  range: { from: string; to: string; days: number };
  revenue: Money;
  revenueChangePercent: number | null;
  orders: number;
  averageOrderValue: Money;
  series: { date: string; revenue: Money; orders: number }[];
  byStatus: Record<string, number>;
  toPack: number;
  toShip: number;
  topProducts: { name: string; packSize: string; units: number; revenue: Money }[];
  lowStock: { variantId: string; name: string; packSize: string; available: number; threshold: number }[];
  expiringSoon: { batch: string; name: string; expiresOn: string; units: number }[];
  recentOrders: { id: string; number: string; status: string; customer: string; city: string; total: Money; items: number; placedAt: string }[];
}

function Stat({ label, value, note, onClick }: { label: string; value: string; note?: string; onClick?: () => void }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag onClick={onClick} className={`rounded-4 border border-rule bg-paper p-4 text-left ${onClick ? 'transition-colors hover:border-forest' : ''}`}>
      <p className="text-xs uppercase tracking-[0.12em] text-ink-2">{label}</p>
      <p className="num mt-2 text-3xl">{value}</p>
      {note && <p className="mt-1 text-xs text-ink-2">{note}</p>}
    </Tag>
  );
}

export function DashboardPage() {
  const [days, setDays] = useState(7);
  const [d, setD] = useState<Dashboard | null>(null);
  useEffect(() => {
    api<Dashboard>(`/v1/admin/dashboard?days=${days}`).then(setD);
  }, [days]);
  const go = (hash: string) => (location.hash = hash);

  return (
    <Page
      title="Dashboard"
      subtitle={d ? `${day(d.range.from)} – ${day(d.range.to)}` : ' '}
      actions={[7, 30, 90].map((n) => (
        <Btn key={n} variant={days === n ? 'solid' : 'outline'} onClick={() => setDays(n)}>
          {n} days
        </Btn>
      ))}
    >
      {d && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <Stat
              label="Revenue"
              value={rupees(d.revenue.amount)}
              note={d.revenueChangePercent === null ? 'No earlier period to compare' : `${d.revenueChangePercent >= 0 ? '▲' : '▼'} ${Math.abs(d.revenueChangePercent)}% vs previous ${days} days`}
            />
            <Stat label="Paid orders" value={String(d.orders)} />
            <Stat label="Average order" value={rupees(d.averageOrderValue.amount)} />
            <Stat label="To pack" value={String(d.toPack)} note="Paid, waiting for the warehouse" onClick={() => go('#/orders?status=confirmed')} />
            <Stat label="To ship" value={String(d.toShip)} note="Packed, waiting for the courier" onClick={() => go('#/orders?status=packed')} />
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <Card title="Daily revenue" className="xl:col-span-2">
              <RevenueChart series={d.series} />
            </Card>
            <Card title="Top products">
              <ol className="space-y-2">
                {d.topProducts.map((t, i) => (
                  <li key={t.name + t.packSize} className="flex items-baseline gap-3">
                    <span className="num w-4 text-ink-3">{i + 1}</span>
                    <span className="flex-1">
                      {t.name} <span className="text-ink-2">{t.packSize}</span>
                    </span>
                    <span className="num text-ink-2">{t.units}×</span>
                    <span className="num w-20 text-right">{rupees(t.revenue.amount)}</span>
                  </li>
                ))}
                {d.topProducts.length === 0 && <li className="text-ink-2">No sales in this period.</li>}
              </ol>
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <Card title="Recent orders" className="xl:col-span-2" action={<Btn variant="ghost" onClick={() => go('#/orders')}>All orders →</Btn>}>
              <table className="w-full">
                <thead>
                  <tr className="rule-b">
                    <th className={th}>Order</th>
                    <th className={th}>Customer</th>
                    <th className={th}>Status</th>
                    <th className={`${th} text-right`}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {d.recentOrders.map((o) => (
                    <tr key={o.id} onClick={() => go(`#/orders/${o.id}`)} className="cursor-pointer rule-b hover:bg-paper-2">
                      <td className={td}>
                        <span className="num">{o.number}</span>
                        <span className="block text-xs text-ink-2">{when(o.placedAt)}</span>
                      </td>
                      <td className={td}>
                        {o.customer} <span className="text-ink-2">· {o.city}</span>
                      </td>
                      <td className={td}>
                        <StatusBadge status={o.status} />
                      </td>
                      <td className={`${td} num text-right`}>{rupees(o.total.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
            <div className="space-y-4">
              <Card title="Low stock" action={<Btn variant="ghost" onClick={() => go('#/inventory')}>Inventory →</Btn>}>
                {d.lowStock.length === 0 ? (
                  <p className="text-ink-2">Everything is above its reorder level.</p>
                ) : (
                  <ul className="space-y-2">
                    {d.lowStock.map((l) => (
                      <li key={l.variantId} className="flex items-center justify-between gap-2">
                        <span>
                          {l.name} <span className="text-ink-2">{l.packSize}</span>
                        </span>
                        <span className={`num rounded-pill px-2 py-0.5 text-xs ${l.available === 0 ? 'bg-alert text-paper' : 'bg-[#fdecc8] text-[#7a4b00]'}`}>
                          {l.available} left · reorder at {l.threshold}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
              <Card title="Expiring within 30 days">
                {d.expiringSoon.length === 0 ? (
                  <p className="text-ink-2">No batches close to expiry.</p>
                ) : (
                  <ul className="space-y-2">
                    {d.expiringSoon.map((e) => (
                      <li key={e.batch} className="flex items-center justify-between gap-2">
                        <span>
                          {e.name}
                          <span className="num block text-xs text-ink-2">{e.batch}</span>
                        </span>
                        <span className="num text-right text-sm">
                          {e.units} units
                          <span className="block text-xs text-alert">expires {day(e.expiresOn)}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          </div>
        </div>
      )}
    </Page>
  );
}
