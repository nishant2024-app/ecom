import { createDeps } from './bootstrap';
import { expireUnpaidOrders } from './services/orders';

/**
 * Background worker. Every minute it closes unpaid orders whose payment window passed,
 * after asking the payment provider whether they were in fact paid (missed webhooks).
 * Safe to run more than one: each order is re-checked under a row lock.
 */
const deps = await createDeps(undefined, 'worker');
const log = (msg: string, extra: object = {}) => console.log(JSON.stringify({ time: new Date().toISOString(), msg, ...extra }));

let running = false;
let stopping = false;
async function tick() {
  if (running || stopping) return;
  running = true;
  try {
    const result = await expireUnpaidOrders(deps);
    if (result.expired || result.paid) log('orders.expiry', result);
  } catch (err) {
    log('worker.tick_failed', { error: err instanceof Error ? err.message : String(err) });
  } finally {
    running = false;
  }
}

const timer = setInterval(tick, 60_000);
log('worker.started', { payments: deps.payments.name });
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
