import { useEffect, useMemo, useRef, useState } from 'react';
import type { ColumnDefinition } from 'tabulator-tables';
import { el, pill } from '../components/cells';
import { DataTable } from '../components/DataTable';
import { Btn, Drawer, Field, Page, input } from '../components/ui';
import { api, ApiError } from '../lib/api';
import { rupees } from '../lib/format';

interface Coupon {
  id: string;
  code: string;
  description: string;
  kind: 'percent' | 'fixed';
  percentBps: number | null;
  amountPaise: number | null;
  maxDiscountPaise: number | null;
  minSubtotalPaise: number;
  startsAt: string | null;
  endsAt: string | null;
  usageLimit: number | null;
  perCustomerLimit: number;
  firstOrderOnly: boolean;
  status: 'active' | 'paused';
  used: number;
  discountGivenPaise: number;
}

interface Form {
  id?: string;
  code: string;
  kind: 'percent' | 'fixed';
  percent: string;
  amount: string;
  maxDiscount: string;
  minSubtotal: string;
  startsAt: string;
  endsAt: string;
  usageLimit: string;
  perCustomerLimit: string;
  firstOrderOnly: boolean;
  status: 'active' | 'paused';
  description: string;
}

const blank: Form = {
  code: '',
  kind: 'percent',
  percent: '10',
  amount: '100',
  maxDiscount: '',
  minSubtotal: '',
  startsAt: '',
  endsAt: '',
  usageLimit: '',
  perCustomerLimit: '1',
  firstOrderOnly: false,
  status: 'active',
  description: '',
};
const toDate = (iso: string | null) => (iso ? iso.slice(0, 10) : '');
const fromDate = (d: string, end = false) => (d ? new Date(`${d}T${end ? '23:59:59' : '00:00:00'}+05:30`).toISOString() : null);
const num = (v: string) => (v.trim() === '' ? null : Math.round(Number(v) * 100));

function offerText(c: Coupon) {
  const base = c.kind === 'percent' ? `${(c.percentBps ?? 0) / 100}% off${c.maxDiscountPaise ? `, up to ${rupees(c.maxDiscountPaise)}` : ''}` : `${rupees(c.amountPaise ?? 0)} off`;
  return base;
}

function state(c: Coupon) {
  const now = Date.now();
  if (c.status === 'paused') return { label: 'Paused', cls: 'bg-paper-3 text-ink-2' };
  if (c.endsAt && new Date(c.endsAt).getTime() < now) return { label: 'Expired', cls: 'bg-paper-3 text-ink-2' };
  if (c.startsAt && new Date(c.startsAt).getTime() > now) return { label: 'Scheduled', cls: 'bg-[#fdecc8] text-[#7a4b00]' };
  if (c.usageLimit !== null && c.used >= c.usageLimit) return { label: 'Fully used', cls: 'bg-paper-3 text-ink-2' };
  return { label: 'Live', cls: 'bg-meadow text-forest' };
}

const TONE: Record<string, 'on' | 'off' | 'warn'> = { Live: 'on', Scheduled: 'warn', Paused: 'off', Expired: 'off', 'Fully used': 'off' };

function couponColumns(act: { current: { edit: (c: Coupon) => void; canWrite: boolean } }): ColumnDefinition[] {
  return [
    {
      title: 'Code',
      field: 'code',
      minWidth: 170,
      responsive: 0,
      formatter: (cell) => {
        const c = cell.getData() as Coupon;
        const name = act.current.canWrite
          ? el('a', { class: 'dt-link dt-num', href: '#/coupons', text: c.code, onClick: (e) => (e.preventDefault(), act.current.edit(c)) })
          : el('span', { class: 'dt-link dt-num', text: c.code });
        return el('div', {}, name, c.description ? el('span', { class: 'dt-sub', text: c.description }) : null);
      },
    },
    { title: 'Offer', field: 'offer', minWidth: 150, responsive: 1, headerSort: false, formatter: (cell) => el('span', { text: offerText(cell.getData() as Coupon) }) },
    {
      title: 'Rules',
      field: 'rules',
      minWidth: 220,
      responsive: 4,
      headerSort: false,
      formatter: (cell) => {
        const c = cell.getData() as Coupon;
        return el('span', {
          class: 'dt-muted',
          text: [
            c.minSubtotalPaise ? `min ${rupees(c.minSubtotalPaise)}` : null,
            c.firstOrderOnly ? 'first order only' : null,
            `${c.perCustomerLimit} per customer`,
            c.endsAt ? `until ${toDate(c.endsAt)}` : null,
          ]
            .filter(Boolean)
            .join(' · '),
        });
      },
    },
    {
      title: 'Used',
      field: 'used',
      width: 100,
      responsive: 3,
      hozAlign: 'right',
      cssClass: 'dt-right',
      sorter: 'number',
      formatter: (cell) => {
        const c = cell.getData() as Coupon;
        return el('span', { class: 'dt-num', text: `${c.used}${c.usageLimit ? ` / ${c.usageLimit}` : ''}` });
      },
    },
    {
      title: 'Given away',
      field: 'discountGivenPaise',
      width: 130,
      responsive: 5,
      hozAlign: 'right',
      cssClass: 'dt-right',
      sorter: 'number',
      formatter: (cell) => el('span', { class: 'dt-num', text: rupees(cell.getValue() as number) }),
    },
    {
      title: 'Status',
      field: 'status',
      width: 120,
      responsive: 2,
      formatter: (cell) => {
        const st = state(cell.getData() as Coupon);
        return pill(st.label, TONE[st.label] ?? 'off');
      },
    },
  ];
}

export function CouponsPage({ permissions }: { permissions: string[] }) {
  const [rows, setRows] = useState<Coupon[]>([]);
  const [form, setForm] = useState<Form | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canWrite = permissions.includes('pricing.write');
  const load = () => api<{ data: Coupon[] }>('/v1/admin/coupons').then((r) => setRows(r.data));
  useEffect(() => {
    void load();
  }, []);

  const edit = (c: Coupon) =>
    setForm({
      id: c.id,
      code: c.code,
      kind: c.kind,
      percent: c.percentBps ? String(c.percentBps / 100) : '10',
      amount: c.amountPaise ? String(c.amountPaise / 100) : '100',
      maxDiscount: c.maxDiscountPaise ? String(c.maxDiscountPaise / 100) : '',
      minSubtotal: c.minSubtotalPaise ? String(c.minSubtotalPaise / 100) : '',
      startsAt: toDate(c.startsAt),
      endsAt: toDate(c.endsAt),
      usageLimit: c.usageLimit ? String(c.usageLimit) : '',
      perCustomerLimit: String(c.perCustomerLimit),
      firstOrderOnly: c.firstOrderOnly,
      status: c.status,
      description: c.description,
    });

  async function save() {
    if (!form) return;
    setError(null);
    const body = {
      code: form.code,
      description: form.description,
      kind: form.kind,
      ...(form.kind === 'percent' ? { percentBps: Math.round(Number(form.percent) * 100), maxDiscountPaise: num(form.maxDiscount) } : { amountPaise: num(form.amount) ?? 0 }),
      minSubtotalPaise: num(form.minSubtotal) ?? 0,
      startsAt: fromDate(form.startsAt),
      endsAt: fromDate(form.endsAt, true),
      usageLimit: form.usageLimit.trim() ? Number(form.usageLimit) : null,
      perCustomerLimit: Number(form.perCustomerLimit) || 1,
      firstOrderOnly: form.firstOrderOnly,
      status: form.status,
    };
    try {
      await api(form.id ? `/v1/admin/coupons/${form.id}` : '/v1/admin/coupons', { method: form.id ? 'PUT' : 'POST', body: JSON.stringify(body) });
      setForm(null);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? (e.problem.errors?.[0] ? `${e.problem.errors[0].field}: ${e.problem.errors[0].message}` : (e.problem.detail ?? e.problem.title)) : 'Could not save');
    }
  }

  const act = useRef({ edit: (_c: Coupon) => {}, canWrite });
  act.current = { edit, canWrite };
  const tableRows = rows;
  const columns = useMemo<ColumnDefinition[]>(() => couponColumns(act), []);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));

  return (
    <Page
      title="Coupons"
      subtitle="Discount codes customers type in the cart. The discount comes off the products, not shipping."
      actions={
        canWrite && (
          <Btn variant="primary" onClick={() => setForm({ ...blank })}>
            + New coupon
          </Btn>
        )
      }
    >
      <DataTable
        label="Coupons"
        data={tableRows}
        columns={columns}
        onRowClick={(c) => canWrite && act.current.edit(c)}
        initialSort={[{ column: 'code', dir: 'asc' }]}
        placeholder="No coupons yet. Create one, for example WELCOME10: 10% off a first order."
      />

      <Drawer open={!!form} onClose={() => setForm(null)} title={form?.id ? `Edit ${form.code}` : 'New coupon'}>
        {form && (
          <div className="space-y-4">
            <Field label="Code customers type" hint="Letters, numbers, dash. Example: DIWALI10">
              <input value={form.code} onChange={(e) => set('code', e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''))} className={`${input} num`} maxLength={24} />
            </Field>
            <Field label="Note for staff (optional)">
              <input value={form.description} onChange={(e) => set('description', e.target.value)} className={input} />
            </Field>
            <div className="flex gap-2" role="radiogroup" aria-label="Type of discount">
              {(['percent', 'fixed'] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={form.kind === k}
                  onClick={() => set('kind', k)}
                  className={`rounded-pill border px-4 py-2 text-sm font-semibold ${form.kind === k ? 'border-forest bg-meadow text-forest' : 'border-rule'}`}
                >
                  {k === 'percent' ? 'Percent off' : 'Rupees off'}
                </button>
              ))}
            </div>
            {form.kind === 'percent' ? (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Percent off">
                  <input type="number" min={1} max={100} step="0.5" value={form.percent} onChange={(e) => set('percent', e.target.value)} className={`${input} num`} />
                </Field>
                <Field label="At most ₹ (optional)">
                  <input type="number" min={1} value={form.maxDiscount} onChange={(e) => set('maxDiscount', e.target.value)} className={`${input} num`} />
                </Field>
              </div>
            ) : (
              <Field label="Rupees off">
                <input type="number" min={1} value={form.amount} onChange={(e) => set('amount', e.target.value)} className={`${input} num`} />
              </Field>
            )}
            <Field label="Minimum order value ₹ (optional)" hint="Counted on products before the discount">
              <input type="number" min={0} value={form.minSubtotal} onChange={(e) => set('minSubtotal', e.target.value)} className={`${input} num`} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Starts (optional)">
                <input type="date" value={form.startsAt} onChange={(e) => set('startsAt', e.target.value)} className={input} />
              </Field>
              <Field label="Ends (optional)" hint="Valid until the end of this day">
                <input type="date" value={form.endsAt} onChange={(e) => set('endsAt', e.target.value)} className={input} />
              </Field>
              <Field label="Total uses (optional)" hint="Across all customers">
                <input type="number" min={1} value={form.usageLimit} onChange={(e) => set('usageLimit', e.target.value)} className={`${input} num`} />
              </Field>
              <Field label="Uses per customer">
                <input type="number" min={1} value={form.perCustomerLimit} onChange={(e) => set('perCustomerLimit', e.target.value)} className={`${input} num`} />
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.firstOrderOnly} onChange={(e) => set('firstOrderOnly', e.target.checked)} className="accent-[var(--forest)]" /> First order only (customers with no
              earlier paid order)
            </label>
            <Field label="Status">
              <select value={form.status} onChange={(e) => set('status', e.target.value as Form['status'])} className={input}>
                <option value="active">Active</option>
                <option value="paused">Paused (customers can't use it)</option>
              </select>
            </Field>
            <p className="rounded-3 bg-paper-2 p-3 text-xs text-ink-2">
              Free shipping is decided on the amount customers pay for products <strong>after</strong> the discount. GST is recalculated on the discounted prices. Cancelled orders give the use back.
            </p>
            <div className="sticky bottom-0 -mx-5 -mb-5 flex flex-wrap items-center gap-3 border-t border-rule bg-paper px-5 py-3">
              <Btn variant="primary" onClick={save}>
                {form.id ? 'Save changes' : 'Create coupon'}
              </Btn>
              {error && (
                <p role="alert" className="text-sm text-alert">
                  {error}
                </p>
              )}
            </div>
          </div>
        )}
      </Drawer>
    </Page>
  );
}
