import { addDays, isCutoffPassed, slotRunsOn, todayIST } from '@dairy/core';
import { schema as s } from '@dairy/db';
import { and, eq } from 'drizzle-orm';
import { createDeps } from './bootstrap';
import { runCutoff } from './services/cutoff';
import { activeSlots, holidaySet } from './services/store';

/**
 * Background worker. Every minute it checks whether any slot's cutoff has passed for
 * today or tomorrow without a completed cutoff run, and runs it. Because runCutoff is
 * idempotent, this loop is safe across restarts and multiple workers (advisory lock).
 */
const deps = await createDeps(undefined, 'worker');
const { db } = deps.db;
const log = (msg: string, extra: object = {}) => console.log(JSON.stringify({ time: new Date().toISOString(), msg, ...extra }));

async function tick() {
  const now = new Date();
  const sellers = await db.select({ id: s.sellers.id }).from(s.sellers).where(eq(s.sellers.status, 'active'));
  for (const seller of sellers) {
    for (const slot of await activeSlots(db, seller.id)) {
      const today = todayIST(now);
      for (const date of [today, addDays(today, 1)]) {
        if (!slotRunsOn(date, slot.timing) || !isCutoffPassed(date, slot.timing, now)) continue;
        if ((await holidaySet(db, seller.id, slot.id, date, date)).has(date)) continue;
        const done = await db
          .select({ id: s.cutoffRuns.id })
          .from(s.cutoffRuns)
          .where(and(eq(s.cutoffRuns.deliveryDate, date), eq(s.cutoffRuns.slotId, slot.id), eq(s.cutoffRuns.status, 'completed')))
          .limit(1);
        if (done.length) continue;
        log('cutoff.start', { date, slot: slot.code });
        try {
          const stats = await runCutoff(db, { date, slotId: slot.id });
          log('cutoff.completed', { date, slot: slot.code, stats });
        } catch (err) {
          log('cutoff.failed', { date, slot: slot.code, error: err instanceof Error ? err.message : String(err) });
        }
      }
    }
  }
}

let running = false;
let stopping = false;
const timer = setInterval(async () => {
  if (running || stopping) return;
  running = true;
  try {
    await tick();
  } catch (err) {
    log('worker.tick_failed', { error: err instanceof Error ? err.message : String(err) });
  } finally {
    running = false;
  }
}, 60_000);
log('worker.started');
void tick();

for (const sig of ['SIGTERM', 'SIGINT'] as const) {
  process.on(sig, async () => {
    stopping = true;
    clearInterval(timer);
    while (running) await new Promise((r) => setTimeout(r, 200));
    await deps.db.close();
    await deps.kv.close();
    process.exit(0);
  });
}
