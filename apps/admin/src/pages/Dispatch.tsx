import { Button } from '@dairy/ui';
import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, tomorrowIST } from '../lib/api';

interface Slot {
  id: string;
  code: string;
  label: string;
}
interface Board {
  date: string;
  cutoff: { status: string; startedAt?: string; finishedAt?: string | null; error?: string | null; stats?: Record<string, unknown> };
  runs: { id: string; route: { name: string }; agent: { name: string } | null; status: string; stopCount: number; byStatus: Record<string, number> }[];
}

const STATUSES = ['scheduled', 'packed', 'out_for_delivery', 'delivered', 'not_available', 'missed', 'skipped_low_balance'];

export function DispatchPage() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotId, setSlotId] = useState('');
  const [date, setDate] = useState(tomorrowIST());
  const [board, setBoard] = useState<Board | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    api<{ data: Slot[] }>('/v1/admin/slots').then((r) => {
      setSlots(r.data);
      setSlotId(r.data[0]?.id ?? '');
    });
  }, []);

  const load = useCallback(async () => {
    if (!slotId) return;
    setBoard(await api<Board>(`/v1/admin/dispatch?date=${date}&slotId=${slotId}`));
  }, [date, slotId]);
  useEffect(() => {
    void load();
  }, [load]);

  async function runCutoff() {
    if (!confirm(`Run the cutoff for ${date}? Safe to repeat: it never charges a customer twice.`)) return;
    setBusy(true);
    setMessage(null);
    try {
      const r = await api<{ stats: { scheduled: number; skippedLowBalance: number; chargedPaise: number } }>('/v1/admin/dispatch/cutoff-runs', {
        method: 'POST',
        idempotencyKey: crypto.randomUUID(),
        body: JSON.stringify({ date, slotId }),
      });
      setMessage(`Done: ${r.stats.scheduled} scheduled, ${r.stats.skippedLowBalance} skipped for low balance, ₹${(r.stats.chargedPaise / 100).toLocaleString('en-IN')} charged.`);
      await load();
    } catch (e) {
      setMessage(e instanceof ApiError ? (e.problem.detail ?? e.problem.title) : 'Cutoff failed');
    } finally {
      setBusy(false);
    }
  }

  const totals = STATUSES.map((s) => [s, board?.runs.reduce((n, r) => n + (r.byStatus[s] ?? 0), 0) ?? 0] as const);
  const stats = board?.cutoff.stats as { deliveries?: number; units?: number; shortfalls?: Record<string, number> } | undefined;

  return (
    <div className="p-6">
      <header className="flex flex-wrap items-end justify-between gap-4 rule-b pb-4">
        <div>
          <h1 className="font-display text-2xl">Dispatch</h1>
          <p className="text-ink-2">Cutoff status, runs and delivery progress for one slot.</p>
        </div>
        <div className="flex items-end gap-2">
          <label className="text-xs text-ink-2">
            Date
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="num mt-1 block h-9 rounded-1 border border-rule bg-paper px-2 text-ink" />
          </label>
          <label className="text-xs text-ink-2">
            Slot
            <select value={slotId} onChange={(e) => setSlotId(e.target.value)} className="mt-1 block h-9 rounded-1 border border-rule bg-paper px-2 text-ink">
              {slots.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <Button size="sm" variant="primary" onClick={runCutoff} disabled={busy || !slotId}>
            {busy ? 'Running…' : 'Run cutoff'}
          </Button>
        </div>
      </header>

      {message && (
        <p role="status" className="mt-4 border-l-4 border-signal bg-paper-2 px-3 py-2">
          {message}
        </p>
      )}

      <section className="mt-6 grid grid-cols-2 gap-px border border-rule bg-rule md:grid-cols-4">
        <Stat label="Cutoff" value={board?.cutoff.status ?? '—'} tone={board?.cutoff.status === 'failed' ? 'alert' : undefined} />
        <Stat label="Deliveries" value={String(stats?.deliveries ?? '—')} />
        <Stat label="Units" value={String(stats?.units ?? '—')} />
        <Stat label="Short of stock" value={String(Object.values(stats?.shortfalls ?? {}).reduce((a, b) => a + b, 0))} />
      </section>
      {board?.cutoff.error && <p className="mt-2 text-alert">{board.cutoff.error}</p>}

      <table className="mt-6 w-full border-collapse text-left">
        <thead>
          <tr className="text-xs uppercase tracking-[0.1em] text-ink-2 rule-b">
            <th className="py-2 pr-4 font-normal">Route</th>
            <th className="py-2 pr-4 font-normal">Agent</th>
            <th className="py-2 pr-4 font-normal">Run</th>
            <th className="py-2 pr-4 text-right font-normal">Stops</th>
            {STATUSES.map((s) => (
              <th key={s} className="py-2 pr-4 text-right font-normal">
                {s.replaceAll('_', ' ')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {board?.runs.map((r) => (
            <tr key={r.id} className="rule-b hover:bg-paper-2">
              <td className="py-2 pr-4">{r.route.name}</td>
              <td className="py-2 pr-4 text-ink-2">{r.agent?.name ?? 'Unassigned'}</td>
              <td className="py-2 pr-4">{r.status}</td>
              <td className="num py-2 pr-4 text-right">{r.stopCount}</td>
              {STATUSES.map((s) => (
                <td key={s} className="num py-2 pr-4 text-right">
                  {r.byStatus[s] ?? ''}
                </td>
              ))}
            </tr>
          ))}
          {board && board.runs.length === 0 && (
            <tr>
              <td colSpan={4 + STATUSES.length} className="py-6 text-ink-2">
                No runs yet. Runs appear after the cutoff job.
              </td>
            </tr>
          )}
        </tbody>
        {board && board.runs.length > 0 && (
          <tfoot>
            <tr className="font-medium">
              <td className="py-2 pr-4" colSpan={3}>
                Total
              </td>
              <td className="num py-2 pr-4 text-right">{board.runs.reduce((n, r) => n + r.stopCount, 0)}</td>
              {totals.map(([s, n]) => (
                <td key={s} className="num py-2 pr-4 text-right">
                  {n || ''}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'alert' }) {
  return (
    <div className="bg-paper p-4">
      <p className="text-xs uppercase tracking-[0.1em] text-ink-2">{label}</p>
      <p className={`num mt-1 text-xl ${tone === 'alert' ? 'text-alert' : ''}`}>{value}</p>
    </div>
  );
}
