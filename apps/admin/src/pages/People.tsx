import { useEffect, useState, type FormEvent } from 'react';
import type { ColumnDefinition } from 'tabulator-tables';
import { el } from '../components/cells';
import { DataTable } from '../components/DataTable';
import { Btn, Card, Field, Page, StatusBadge, input, td, th } from '../components/ui';
import { api, ApiError } from '../lib/api';
import { day, rupees, when, type Money } from '../lib/format';

interface CustomerRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  orders: number;
  spent: Money;
  lastOrderAt: string | null;
  joinedAt: string;
}

const customerColumns: ColumnDefinition[] = [
  {
    title: 'Customer',
    field: 'name',
    minWidth: 200,
    responsive: 0,
    formatter: (cell) => {
      const c = cell.getData() as CustomerRow;
      return el('div', {}, el('a', { class: 'dt-link', href: `#/customers/${c.id}`, text: c.name }), el('span', { class: 'dt-sub', text: c.email }));
    },
  },
  { title: 'Phone', field: 'phone', width: 160, responsive: 3, formatter: (cell) => el('span', { class: 'dt-num', text: (cell.getValue() as string | null) ?? '—' }) },
  {
    title: 'Orders',
    field: 'orders',
    width: 100,
    responsive: 1,
    hozAlign: 'right',
    cssClass: 'dt-right',
    sorter: 'number',
    formatter: (cell) => el('span', { class: 'dt-num', text: String(cell.getValue()) }),
  },
  {
    title: 'Spent',
    field: 'spentPaise',
    width: 130,
    hozAlign: 'right',
    cssClass: 'dt-right',
    sorter: 'number',
    formatter: (cell) => el('span', { class: 'dt-num', text: rupees(cell.getValue() as number) }),
  },
  { title: 'Last order', field: 'lastOrderAt', width: 140, responsive: 4, formatter: (cell) => el('span', { class: 'dt-num', text: cell.getValue() ? day(cell.getValue() as string) : '—' }) },
  { title: 'Joined', field: 'joinedAt', width: 120, responsive: 5, formatter: (cell) => el('span', { class: 'dt-num', text: day(cell.getValue() as string) }) },
];

export function CustomersPage() {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<(CustomerRow & { spentPaise: number })[]>([]);
  useEffect(() => {
    const t = setTimeout(
      () => api<{ data: CustomerRow[] }>(`/v1/admin/customers${q ? `?q=${encodeURIComponent(q)}` : ''}`).then((r) => setRows(r.data.map((c) => ({ ...c, spentPaise: c.spent.amount })))),
      200,
    );
    return () => clearTimeout(t);
  }, [q]);
  return (
    <Page title="Customers" subtitle="Everyone who has signed in, with what they've bought.">
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email, phone" aria-label="Search customers" className={`${input} mb-4 max-w-xs`} />
      <DataTable
        label="Customers"
        data={rows}
        columns={customerColumns}
        onRowClick={(c) => (location.hash = `#/customers/${c.id}`)}
        initialSort={[{ column: 'joinedAt', dir: 'desc' }]}
        placeholder="No customers yet."
      />
    </Page>
  );
}

export function CustomerDetailPage({ id }: { id: string }) {
  const [c, setC] = useState<{
    name: string;
    email: string;
    phone: string | null;
    joinedAt: string;
    addresses: { id: string; name: string; line1: string; city: string; state: string; pincode: string; phone: string }[];
    orders: { id: string; number: string; status: string; total: Money; placedAt: string }[];
  } | null>(null);
  useEffect(() => {
    api<typeof c>(`/v1/admin/customers/${id}`).then(setC);
  }, [id]);
  const paid = (c?.orders ?? []).filter((o) => ['confirmed', 'packed', 'shipped', 'delivered'].includes(o.status));
  if (!c)
    return (
      <Page title="Customer">
        <p className="text-ink-2">Loading…</p>
      </Page>
    );
  return (
    <Page
      title={c.name}
      subtitle={`${c.email} · joined ${day(c.joinedAt)} · ${paid.length} paid order${paid.length === 1 ? '' : 's'}, ${rupees(paid.reduce((n, o) => n + o.total.amount, 0))} spent`}
      actions={
        <Btn variant="outline" onClick={() => history.back()}>
          ← Back
        </Btn>
      }
    >
      <div className="grid gap-4 xl:grid-cols-3">
        <Card title="Orders" className="xl:col-span-2">
          <table className="w-full">
            <tbody>
              {c.orders.map((o) => (
                <tr key={o.id} onClick={() => (location.hash = `#/orders/${o.id}`)} className="cursor-pointer rule-b hover:bg-paper-2">
                  <td className={td}>
                    <a href={`#/orders/${o.id}`} className="num font-semibold hover:underline">
                      {o.number}
                    </a>
                  </td>
                  <td className={`${td} num text-ink-2`}>{when(o.placedAt)}</td>
                  <td className={td}>
                    <StatusBadge status={o.status} />
                  </td>
                  <td className={`${td} num text-right`}>{rupees(o.total.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {c.orders.length === 0 && <p className="text-ink-2">No orders yet.</p>}
        </Card>
        <Card title="Addresses">
          <ul className="space-y-3">
            {c.addresses.map((a) => (
              <li key={a.id}>
                {a.name}
                <span className="block text-sm text-ink-2">
                  {a.line1}, {a.city}, {a.state} <span className="num">{a.pincode}</span>
                </span>
                <span className="num block text-sm">{a.phone}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </Page>
  );
}

interface Zone {
  code: string;
  name: string;
  pincodePrefixes: string[];
  feePaise: number;
  freeAbovePaise: number | null;
  includedGrams: number;
  perExtraKgPaise: number;
  etaMinDays: number;
  etaMaxDays: number;
  serviceable: boolean;
}
interface Staff {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  linked: boolean;
  lastSignInAt: string | null;
}
const ROLES = ['owner', 'admin', 'ops_manager', 'warehouse', 'support', 'content', 'accountant'];

interface StoreDetails {
  name: string;
  legalName: string;
  gstin: string;
  fssaiNumber: string;
  state: string;
  address: string;
  supportPhone: string;
  supportEmail: string;
}

/** Business details shown in the shop footer, policy pages, packing slips and emails. */
function StoreDetailsCard({ canEdit }: { canEdit: boolean }) {
  const [form, setForm] = useState<StoreDetails | null>(null);
  const [state, setState] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api<StoreDetails>('/v1/admin/store').then(setForm);
  }, []);
  if (!form) return null;
  const set = (patch: Partial<StoreDetails>) => setForm((f) => (f ? { ...f, ...patch } : f));
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setState(null);
    try {
      setForm(await api<StoreDetails>('/v1/admin/store', { method: 'PUT', body: JSON.stringify(form) }));
      setState({ kind: 'ok', text: 'Saved. The shop shows the new details within a minute.' });
    } catch (err) {
      const first = err instanceof ApiError ? err.problem.errors?.[0] : undefined;
      setState({ kind: 'error', text: err instanceof ApiError ? (first ? `${first.field}: ${first.message}` : (err.problem.detail ?? err.problem.title)) : 'Could not save' });
    } finally {
      setBusy(false);
    }
  }
  const ro = !canEdit;
  return (
    <Card title="Store details" className="mb-4">
      <form onSubmit={save} className="grid gap-3 md:grid-cols-2">
        <Field label="Shop name" hint="Shown to customers">
          <input value={form.name} onChange={(e) => set({ name: e.target.value })} readOnly={ro} required minLength={2} className={input} />
        </Field>
        <Field label="Legal business name" hint="On invoices and the policy pages">
          <input value={form.legalName} onChange={(e) => set({ legalName: e.target.value })} readOnly={ro} required minLength={2} className={input} />
        </Field>
        <Field label="FSSAI licence number" hint="14 digits. Shown in the shop footer">
          <input value={form.fssaiNumber} onChange={(e) => set({ fssaiNumber: e.target.value.replace(/\D/g, '').slice(0, 14) })} readOnly={ro} inputMode="numeric" className={`${input} num`} />
        </Field>
        <Field label="GSTIN" hint="15 characters, for example 27ABCDE1234F1Z5">
          <input
            value={form.gstin}
            onChange={(e) =>
              set({
                gstin: e.target.value
                  .toUpperCase()
                  .replace(/[^0-9A-Z]/g, '')
                  .slice(0, 15),
              })
            }
            readOnly={ro}
            className={`${input} num`}
          />
        </Field>
        <Field label="State" hint="Where you dispatch from (decides GST type)">
          <input value={form.state} onChange={(e) => set({ state: e.target.value })} readOnly={ro} required className={input} />
        </Field>
        <Field label="Support phone">
          <input value={form.supportPhone} onChange={(e) => set({ supportPhone: e.target.value })} readOnly={ro} inputMode="tel" className={`${input} num`} />
        </Field>
        <Field label="Support email">
          <input type="email" value={form.supportEmail} onChange={(e) => set({ supportEmail: e.target.value })} readOnly={ro} className={input} />
        </Field>
        <Field label="Registered address" hint="Shown on the contact and policy pages">
          <input value={form.address} onChange={(e) => set({ address: e.target.value })} readOnly={ro} maxLength={300} className={input} />
        </Field>
        <div className="flex items-center gap-3 md:col-span-2">
          {canEdit && (
            <Btn variant="primary" type="submit" disabled={busy}>
              {busy ? 'Saving…' : 'Save store details'}
            </Btn>
          )}
          {state && (
            <p role={state.kind === 'error' ? 'alert' : 'status'} className={`text-sm ${state.kind === 'error' ? 'text-alert' : 'text-forest'}`}>
              {state.text}
            </p>
          )}
          {!canEdit && <p className="text-sm text-ink-2">Only the owner or an admin can change these.</p>}
        </div>
      </form>
    </Card>
  );
}

export function SettingsPage({ permissions, meId }: { permissions: string[]; meId: string }) {
  const [zones, setZones] = useState<Zone[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const canSettings = permissions.includes('settings.write');
  const canStaff = permissions.includes('staff.manage');
  useEffect(() => {
    api<{ data: Zone[] }>('/v1/admin/shipping-zones').then((r) => setZones(r.data));
    if (canStaff) api<{ data: Staff[] }>('/v1/admin/staff').then((r) => setStaff(r.data));
  }, [canStaff]);

  async function saveZone(z: Zone) {
    setMsg(null);
    try {
      const { code, ...body } = z;
      await api(`/v1/admin/shipping-zones/${code}`, { method: 'PUT', body: JSON.stringify(body) });
      setMsg(`Saved ${z.name}`);
    } catch (e) {
      setMsg(e instanceof ApiError ? (e.problem.detail ?? e.problem.title) : 'Could not save');
    }
  }
  async function invite(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      const s = await api<Staff>('/v1/admin/staff', { method: 'POST', body: JSON.stringify({ email: f.get('email'), name: f.get('name'), role: f.get('role') }) });
      setStaff((x) => [...x, s]);
      (e.target as HTMLFormElement).reset();
    } catch (err) {
      setMsg(err instanceof ApiError ? (err.problem.detail ?? err.problem.title) : 'Invite failed');
    }
  }
  async function patchStaff(id: string, body: Partial<Staff>) {
    try {
      const s = await api<Staff>(`/v1/admin/staff/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
      setStaff((x) => x.map((m) => (m.id === id ? s : m)));
    } catch (err) {
      setMsg(err instanceof ApiError ? (err.problem.detail ?? err.problem.title) : 'Update failed');
    }
  }

  const rupee = (p: number | null) => (p === null ? '' : String(p / 100));
  return (
    <Page title="Settings" subtitle="Store details, shipping rates and your team.">
      {msg && (
        <p role="status" className="mb-4 rounded-3 bg-paper-2 p-3">
          {msg}
        </p>
      )}
      <StoreDetailsCard canEdit={canSettings} />
      <Card title="Shipping zones (longest pincode prefix wins)">
        <div className="space-y-3">
          {zones.map((z, i) => {
            const set = (patch: Partial<Zone>) => setZones((all) => all.map((x, j) => (j === i ? { ...x, ...patch } : x)));
            return (
              <fieldset key={z.code} disabled={!canSettings} className="grid gap-2 rounded-3 bg-paper-2 p-3 md:grid-cols-8">
                <div className="md:col-span-2">
                  <Field label="Zone">
                    <input value={z.name} onChange={(e) => set({ name: e.target.value })} className={input} />
                  </Field>
                </div>
                <div className="md:col-span-2">
                  <Field label="Pincode prefixes">
                    <input value={z.pincodePrefixes.join(', ')} onChange={(e) => set({ pincodePrefixes: e.target.value.split(/[,\s]+/).filter(Boolean) })} className={`${input} num`} />
                  </Field>
                </div>
                <Field label="Fee ₹">
                  <input type="number" value={rupee(z.feePaise)} onChange={(e) => set({ feePaise: Math.round(Number(e.target.value) * 100) })} className={`${input} num`} />
                </Field>
                <Field label="Free above ₹">
                  <input
                    type="number"
                    value={rupee(z.freeAbovePaise)}
                    placeholder="never"
                    onChange={(e) => set({ freeAbovePaise: e.target.value === '' ? null : Math.round(Number(e.target.value) * 100) })}
                    className={`${input} num`}
                  />
                </Field>
                <Field label="Days">
                  <div className="flex items-center gap-1">
                    <input type="number" value={z.etaMinDays} onChange={(e) => set({ etaMinDays: Number(e.target.value) })} className={`${input} num`} />–
                    <input type="number" value={z.etaMaxDays} onChange={(e) => set({ etaMaxDays: Number(e.target.value) })} className={`${input} num`} />
                  </div>
                </Field>
                <div className="flex items-end gap-2">
                  <label className="flex items-center gap-1 pb-2 text-xs">
                    <input type="checkbox" checked={z.serviceable} onChange={(e) => set({ serviceable: e.target.checked })} /> Ships
                  </label>
                  {canSettings && (
                    <Btn variant="outline" onClick={() => saveZone(z)}>
                      Save
                    </Btn>
                  )}
                </div>
              </fieldset>
            );
          })}
        </div>
      </Card>

      {canStaff && (
        <Card title="Team" className="mt-4">
          <table className="w-full">
            <thead>
              <tr className="rule-b">
                <th className={th}>Name</th>
                <th className={th}>Role</th>
                <th className={th}>Google linked</th>
                <th className={th}>Last sign-in</th>
                <th className={th}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {staff.map((m) => (
                <tr key={m.id} className={`rule-b ${m.status === 'deactivated' ? 'text-ink-3' : ''}`}>
                  <td className={td}>
                    {m.name}
                    <span className="block text-xs text-ink-2">{m.email}</span>
                  </td>
                  <td className={td}>
                    <select aria-label={`Role of ${m.name}`} value={m.role} disabled={m.id === meId} onChange={(e) => patchStaff(m.id, { role: e.target.value })} className={`${input} w-40`}>
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r.replace('_', ' ')}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className={td}>{m.linked ? 'Yes' : 'Invited'}</td>
                  <td className={`${td} num`}>{m.lastSignInAt ? when(m.lastSignInAt) : '—'}</td>
                  <td className={`${td} text-right`}>
                    {m.id !== meId && (
                      <Btn variant={m.status === 'active' ? 'danger' : 'outline'} onClick={() => patchStaff(m.id, { status: m.status === 'active' ? 'deactivated' : 'active' })}>
                        {m.status === 'active' ? 'Deactivate' : 'Reactivate'}
                      </Btn>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <form onSubmit={invite} className="mt-4 grid gap-2 sm:grid-cols-4">
            <Field label="Google email">
              <input name="email" type="email" required className={input} />
            </Field>
            <Field label="Name">
              <input name="name" required className={input} />
            </Field>
            <Field label="Role">
              <select name="role" aria-label="Role" className={input} defaultValue="warehouse">
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </Field>
            <div className="flex items-end">
              <Btn type="submit" variant="primary">
                Invite
              </Btn>
            </div>
          </form>
        </Card>
      )}
    </Page>
  );
}
