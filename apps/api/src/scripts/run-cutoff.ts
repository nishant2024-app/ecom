import { parseArgs } from 'node:util';
import { createDeps } from '../bootstrap';
import { runCutoff } from '../services/cutoff';
import { activeSlots, defaultSellerId } from '../services/store';

const { values } = parseArgs({ options: { date: { type: 'string' }, slot: { type: 'string', default: 'morning' } } });
if (!values.date) {
  console.error('usage: pnpm --filter @dairy/api job:cutoff --date YYYY-MM-DD [--slot morning]');
  process.exit(1);
}
const deps = await createDeps(undefined, 'cutoff-cli');
const { db } = deps.db;
const slot = (await activeSlots(db, await defaultSellerId(db))).find((x) => x.code === values.slot || x.id === values.slot);
if (!slot) {
  console.error(`unknown slot ${values.slot}`);
  process.exit(1);
}
console.log(JSON.stringify(await runCutoff(db, { date: values.date, slotId: slot.id }), null, 2));
await deps.db.close();
await deps.kv.close();
