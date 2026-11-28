import { PackShot } from '@dairy/ui';
import { Fragment, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ColumnDefinition } from 'tabulator-tables';
import { el, pill } from '../components/cells';
import { DataTable } from '../components/DataTable';
import { Btn, Card, Drawer, Field, Page, input, td, th } from '../components/ui';
import { api, ApiError } from '../lib/api';
import { day, dayYear, todayIST, when } from '../lib/format';

interface Row {
  variantId: string;
  name: string;
  packSize: string;
  sku: string;
  pack: { kind: string; color: string; accent: string };
  onHand: number;
  reserved: number;
  available: number;
  lowStockThreshold: number;
  low: boolean;
  nextExpiry: string | null;
  batches: number;
}
interface Batch {
  id: string;
  code: string;
  manufacturedOn: string;
  expiresOn: string;
  quantityProduced: number;
  onHand: number;
  reserved: number;
  status: string;
}
interface Movement {
  id: string;
  kind: string;
  quantity: number;
  reason: string | null;
  batchCode: string;
  createdAt: string;
  referenceType: string | null;
}

type InvRow = Row & { id: string };

function inventoryColumns(act: { current: { open: (r: Row) => void } }): ColumnDefinition[] {
  return [
    {
      title: 'Product',
      field: 'name',
      minWidth: 260,
      responsive: 0,
      formatter: (cell) => {
        const r = cell.getData() as InvRow;
        const wrap = el('span', { class: 'dt-thumb-wrap' });
        const art = el('span', { class: 'dt-thumb' });
        art.innerHTML = renderToStaticMarkup(<PackShot kind={r.pack.kind} color={r.pack.color} accent={r.pack.accent} label={r.name} className="h-10 w-8" />);
        wrap.append(
          art,
          el(
            'span',
            {},
            el('a', { class: 'dt-link', href: '#/inventory', text: `${r.name} ${r.packSize}`, onClick: (e) => (e.preventDefault(), act.current.open(r)) }),
            el('span', { class: 'dt-sub dt-num', text: r.sku }),
          ),
        );
        return wrap;
      },
    },
    {
      title: 'On hand',
      field: 'onHand',
      width: 110,
      responsive: 2,
      hozAlign: 'right',
      cssClass: 'dt-right',
      sorter: 'number',
      formatter: (c) => el('span', { class: 'dt-num', text: String(c.getValue()) }),
    },
    {
      title: 'Reserved',
      field: 'reserved',
      width: 110,
      responsive: 4,
      hozAlign: 'right',
      cssClass: 'dt-right',
      sorter: 'number',
      formatter: (c) => el('span', { class: 'dt-num dt-muted', text: String(c.getValue()) }),
    },
    {
      title: 'Available',
      field: 'available',
      width: 120,
      responsive: 1,
      hozAlign: 'right',
      cssClass: 'dt-right',
      sorter: 'number',
      formatter: (c) => ((c.getData() as InvRow).low ? pill(String(c.getValue()), 'warn') : el('span', { class: 'dt-num', text: String(c.getValue()) })),
    },
    {
      title: 'Next expiry',
      field: 'nextExpiry',
      width: 170,
      responsive: 3,
      formatter: (c) => {
        const v = c.getValue() as string | null;
        if (!v) return el('span', { text: '—' });
        return v < todayIST() ? pill(`Expired ${dayYear(v)}`, 'alert') : el('span', { class: 'dt-num', text: dayYear(v) });
      },
    },
    {
      title: 'Batches',
      field: 'batches',
      width: 100,
      responsive: 5,
      hozAlign: 'right',
      cssClass: 'dt-right',
      sorter: 'number',
      formatter: (c) => el('span', { class: 'dt-num', text: String(c.getValue()) }),
    },
  ];
}

export function InventoryPage({ permissions }: { permissions: string[] }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [filter, setFilter] = useState<'all' | 'low'>('all');
  const [open, setOpen] = useState<Row | null>(null);
  const load = () => api<{ data: Row[] }>('/v1/admin/inventory').then((r) => setRows(r.data));
  useEffect(() => {
    void load();
  }, []);
  const act = useRef({ open: (_r: Row) => {} });
  act.current = { open: (r) => setOpen(r) };
  const tableRows = useMemo(() => (filter === 'low' ? rows.filter((r) => r.low) : rows).map((r) => ({ ...r, id: r.variantId })), [rows, filter]);
  const columns = useMemo<ColumnDefinition[]>(() => inventoryColumns(act), []);

  return (
    <Page
      title="Inventory"
      subtitle="Stock by batch. Orders reserve the batch that expires first."
      actions={
        <>
          <Btn variant={filter === 'all' ? 'solid' : 'outline'} onClick={() => setFilter('all')}>
            All
          </Btn>
          <Btn variant={filter === 'low' ? 'solid' : 'outline'} onClick={() => setFilter('low')}>
            Low stock <span className="num">{rows.filter((r) => r.low).length}</span>
          </Btn>
        </>
      }
    >
      <DataTable
        label="Inventory"
        data={tableRows}
        columns={columns}
        onRowClick={(r) => setOpen(rows.find((x) => x.variantId === r.variantId) ?? null)}
        initialSort={[{ column: 'name', dir: 'asc' }]}
        placeholder={filter === 'low' ? 'Nothing is running low.' : 'No stock yet.'}
      />
      <Drawer open={!!open} onClose={() => setOpen(null)} title={open ? `${open.name} ${open.packSize}` : ''} wide>
        {open && <Batches row={open} canWrite={permissions.includes('inventory.write')} onChanged={load} />}
      </Drawer>
    </Page>
  );
}

type AdjustKind = 'count' | 'wasted' | 'returned';

/** Inline editor shown under a batch row: say what happened, type a number, see the result before saving. */
function StockAdjuster({ batch, onSave, onCancel }: { batch: Batch; onSave: (delta: number, kind: 'adjusted' | 'wasted' | 'returned', reason: string) => void; onCancel: () => void }) {
  const [kind, setKind] = useState<AdjustKind>('count');
  const [value, setValue] = useState(String(batch.onHand));
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const n = Number(value);
  const valid = value.trim() !== '' && Number.isInteger(n) && n >= 0;
  const delta = !valid ? 0 : kind === 'count' ? n - batch.onHand : kind === 'wasted' ? -n : n;
  const after = batch.onHand + delta;
  let problem: string | null = null;
  if (!valid) problem = 'Enter a whole number, zero or more.';
  else if (delta === 0) problem = kind === 'count' ? 'That is the same as the current count.' : 'Enter at least 1.';
  else if (after < batch.reserved) problem = `${batch.reserved} unit${batch.reserved === 1 ? ' is' : 's are'} reserved for orders, so the count cannot go below ${batch.reserved}.`;
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, [kind]);
  const base = kind === 'count' ? 'Stock recount' : kind === 'wasted' ? 'Damaged or spoiled' : 'Returned to stock';
  const options: { id: AdjustKind; label: string; hint: string }[] = [
    { id: 'count', label: 'I counted a different number', hint: 'Type what is really on the shelf' },
    { id: 'wasted', label: 'Some are damaged or spoiled', hint: 'Remove units from stock' },
    { id: 'returned', label: 'Units came back', hint: 'Add units to stock' },
  ];
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (problem || busy) return;
        setBusy(true);
        onSave(delta, kind === 'count' ? 'adjusted' : kind, note.trim() ? `${base}: ${note.trim()}` : base);
      }}
      onKeyDown={(e) => e.key === 'Escape' && onCancel()}
    >
      <fieldset>
        <legend className="mb-1 text-sm text-ink-2">What happened to batch {batch.code}?</legend>
        <div className="flex flex-wrap gap-2" role="radiogroup">
          {options.map((o) => (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={kind === o.id}
              title={o.hint}
              onClick={() => {
                setKind(o.id);
                setValue(o.id === 'count' ? String(batch.onHand) : '');
              }}
              className={`rounded-pill border px-3.5 py-1.5 text-sm ${kind === o.id ? 'border-forest bg-meadow font-semibold text-forest' : 'border-rule bg-paper hover:border-forest'}`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor={`adj-${batch.id}`} className="mb-1 block text-sm text-ink-2">
            {kind === 'count' ? 'Units on hand now' : kind === 'wasted' ? 'Units to remove' : 'Units to add'}
          </label>
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="One less"
              className="grid h-9 w-9 place-items-center rounded-pill border border-rule bg-paper hover:bg-paper-3"
              onClick={() => setValue(String(Math.max(0, (valid ? n : 0) - 1)))}
            >
              −
            </button>
            <input
              id={`adj-${batch.id}`}
              ref={ref}
              inputMode="numeric"
              value={value}
              onChange={(e) => setValue(e.target.value.replace(/[^0-9]/g, ''))}
              className={`${input} num w-24 text-center`}
              aria-invalid={!!problem && value !== ''}
            />
            <button
              type="button"
              aria-label="One more"
              className="grid h-9 w-9 place-items-center rounded-pill border border-rule bg-paper hover:bg-paper-3"
              onClick={() => setValue(String((valid ? n : 0) + 1))}
            >
              +
            </button>
          </div>
        </div>
        <div className="min-w-[220px] flex-1">
          <label htmlFor={`note-${batch.id}`} className="mb-1 block text-sm text-ink-2">
            Note (optional, kept in the stock history)
          </label>
          <input id={`note-${batch.id}`} value={note} onChange={(e) => setNote(e.target.value)} maxLength={150} placeholder="For example: dented tins found at packing" className={input} />
        </div>
      </div>
      <p aria-live="polite" className={`text-sm ${problem ? 'text-alert' : 'text-ink-2'}`}>
        {problem ?? (
          <>
            On hand will change from <strong className="num">{batch.onHand}</strong> to <strong className="num">{after}</strong> (
            <span className={delta < 0 ? 'text-alert' : 'text-forest'}>{delta > 0 ? `+${delta}` : `−${Math.abs(delta)}`}</span>).
          </>
        )}
      </p>
      <div className="flex gap-2">
        <Btn variant="primary" type="submit" disabled={!!problem || busy}>
          {busy ? 'Saving…' : 'Save change'}
        </Btn>
        <Btn variant="ghost" onClick={onCancel}>
          Cancel
        </Btn>
      </div>
    </form>
  );
}

function Batches({ row, canWrite, onChanged }: { row: Row; canWrite: boolean; onChanged: () => void }) {
  const [data, setData] = useState<{ data: Batch[]; movements: Movement[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = () => api<{ data: Batch[]; movements: Movement[] }>(`/v1/admin/batches?variantId=${row.variantId}`).then(setData);
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row.variantId]);

  async function addBatch(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setError(null);
    try {
      await api('/v1/admin/batches', {
        method: 'POST',
        body: JSON.stringify({ variantId: row.variantId, code: f.get('code'), manufacturedOn: f.get('manufacturedOn'), expiresOn: f.get('expiresOn'), quantity: Number(f.get('quantity')) }),
      });
      (e.target as HTMLFormElement).reset();
      await load();
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? (err.problem.detail ?? err.problem.title) : 'Could not add batch');
    }
  }
  const [adjusting, setAdjusting] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  async function adjust(b: Batch, delta: number, kind: 'adjusted' | 'wasted' | 'returned', reason: string) {
    setError(null);
    try {
      await api('/v1/admin/stock/adjustments', { method: 'POST', body: JSON.stringify({ batchId: b.id, delta, kind, reason }) });
      setNotice(`Saved. ${b.code}: ${b.onHand} → ${b.onHand + delta} on hand.`);
      setAdjusting(null);
      await load();
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? (err.problem.detail ?? err.problem.title) : 'Adjustment failed');
    }
  }

  const today = todayIST();
  return (
    <div className="space-y-5">
      {error && (
        <p role="alert" className="rounded-3 bg-paper-3 p-3 text-sm text-alert">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="rounded-3 bg-meadow p-3 text-sm text-forest">
          {notice}
        </p>
      )}
      <Card title="Batches (first to expire ships first)">
        <table className="w-full">
          <thead>
            <tr className="rule-b">
              <th className={th}>Batch</th>
              <th className={th}>Made</th>
              <th className={th}>Expires</th>
              <th className={`${th} text-right`}>On hand</th>
              <th className={`${th} text-right`}>Reserved</th>
              <th className={th}>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {data?.data.map((b) => (
              <Fragment key={b.id}>
                <tr className={`rule-b ${adjusting === b.id ? 'bg-paper-2' : ''}`}>
                  <td className={`${td} num`}>{b.code}</td>
                  <td className={`${td} num`}>{day(b.manufacturedOn)}</td>
                  <td className={`${td} num ${b.expiresOn < today ? 'text-alert' : ''}`}>{day(b.expiresOn)}</td>
                  <td className={`${td} num text-right`}>{b.onHand}</td>
                  <td className={`${td} num text-right text-ink-2`}>{b.reserved}</td>
                  <td className={`${td} text-right`}>
                    {canWrite && b.onHand > 0 && (
                      <Btn
                        variant="outline"
                        aria-expanded={adjusting === b.id}
                        aria-label={`${adjusting === b.id ? 'Close' : 'Adjust'} stock for batch ${b.code}`}
                        onClick={() => {
                          setNotice(null);
                          setError(null);
                          setAdjusting(adjusting === b.id ? null : b.id);
                        }}
                      >
                        {adjusting === b.id ? 'Close' : 'Adjust'}
                      </Btn>
                    )}
                  </td>
                </tr>
                {adjusting === b.id && (
                  <tr className="rule-b bg-paper-2">
                    <td colSpan={6} className="px-3 pb-4 pt-1">
                      <StockAdjuster batch={b} onSave={(delta, kind, reason) => adjust(b, delta, kind, reason)} onCancel={() => setAdjusting(null)} />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </Card>
      {canWrite && (
        <Card title="Record a production batch">
          <form onSubmit={addBatch} className="grid gap-3 sm:grid-cols-4">
            <Field label="Batch code">
              <input name="code" required defaultValue={`${row.sku}-${today.replaceAll('-', '').slice(2)}`} className={`${input} num`} />
            </Field>
            <Field label="Made on">
              <input name="manufacturedOn" type="date" required defaultValue={today} className={`${input} num`} />
            </Field>
            <Field label="Expires on">
              <input name="expiresOn" type="date" required className={`${input} num`} />
            </Field>
            <Field label="Units">
              <input name="quantity" type="number" min={1} required className={`${input} num`} />
            </Field>
            <div className="sm:col-span-4">
              <Btn type="submit" variant="primary">
                Add batch
              </Btn>
            </div>
          </form>
        </Card>
      )}
      <Card title="Recent stock movements">
        <ul className="space-y-1.5 text-sm">
          {data?.movements.map((m) => (
            <li key={m.id} className="flex gap-3">
              <span className="num w-40 shrink-0 whitespace-nowrap text-ink-2">{when(m.createdAt)}</span>
              <span className="num w-20">{m.batchCode.split('-').pop()}</span>
              <span className="w-20 capitalize">{m.kind}</span>
              <span className={`num w-14 text-right ${['shipped', 'wasted', 'reserved'].includes(m.kind) || m.quantity < 0 ? 'text-ink-2' : ''}`}>
                {m.quantity > 0 && !['shipped', 'reserved'].includes(m.kind) ? `+${m.quantity}` : m.quantity}
              </span>
              <span className="text-ink-2">{m.reason ?? m.referenceType ?? ''}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
