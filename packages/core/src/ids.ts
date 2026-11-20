/**
 * Prefixed, time-sortable IDs: `cus_01JD3K8Q2V7M4X9TB6N5R1ZC0P`.
 * Body = 48-bit millisecond timestamp + 80 random bits, Crockford base32 (26 chars).
 */

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export const ID_PREFIXES = {
  customer: 'cus',
  staff: 'stf',
  agent: 'agt',
  identity: 'idn',
  session: 'ses',
  address: 'adr',
  device: 'dev',
  seller: 'sel',
  category: 'cat',
  product: 'prd',
  variant: 'var',
  media: 'med',
  review: 'rvw',
  zone: 'zon',
  slot: 'slt',
  holiday: 'hol',
  route: 'rte',
  run: 'run',
  subscription: 'sub',
  subscriptionItem: 'sbi',
  pause: 'pau',
  order: 'ord',
  orderItem: 'ori',
  delivery: 'dlv',
  deliveryItem: 'dli',
  deliveryEvent: 'dle',
  wallet: 'wlt',
  ledger: 'txn',
  ledgerGroup: 'txg',
  topup: 'top',
  payment: 'pay',
  refund: 'rfd',
  invoice: 'inv',
  batch: 'bat',
  stockMovement: 'stm',
  cutoffRun: 'cor',
  orderEvent: 'oev',
  productionPlan: 'ppl',
  webhookEvent: 'whe',
  upload: 'upl',
  audit: 'aud',
  request: 'req',
  ticket: 'tck',
  coupon: 'cpn',
  notification: 'ntf',
} as const;

export type IdPrefix = (typeof ID_PREFIXES)[keyof typeof ID_PREFIXES];

let lastMs = 0;
let lastRandom: Uint8Array = new Uint8Array(10);

function randomBytes(n: number): Uint8Array {
  const b = new Uint8Array(n);
  globalThis.crypto.getRandomValues(b);
  return b;
}

/** Monotonic within the same millisecond (increments the random part). */
function nextRandom(ms: number): Uint8Array {
  if (ms === lastMs) {
    const r = lastRandom.slice();
    for (let i = r.length - 1; i >= 0; i--) {
      r[i] = (r[i]! + 1) & 0xff;
      if (r[i] !== 0) break;
    }
    lastRandom = r;
    return r;
  }
  lastMs = ms;
  lastRandom = randomBytes(10);
  return lastRandom;
}

function encode(ms: number, random: Uint8Array): string {
  // 48-bit time → 10 chars
  let time = '';
  let t = ms;
  for (let i = 0; i < 10; i++) {
    time = ALPHABET[t % 32]! + time;
    t = Math.floor(t / 32);
  }
  // 80-bit random → 16 chars (5 bits each)
  let bits = 0n;
  for (const byte of random) bits = (bits << 8n) | BigInt(byte);
  let rand = '';
  for (let i = 0; i < 16; i++) {
    rand = ALPHABET[Number(bits & 31n)]! + rand;
    bits >>= 5n;
  }
  return time + rand;
}

export function newId(prefix: IdPrefix, now: number = Date.now()): string {
  return `${prefix}_${encode(now, nextRandom(now))}`;
}

const ID_RE = /^([a-z]{3})_[0-9A-HJKMNP-TV-Z]{26}$/;

export function isId(value: string, prefix?: IdPrefix): boolean {
  const m = ID_RE.exec(value);
  return !!m && (prefix === undefined || m[1] === prefix);
}

/** Creation time encoded in an ID. */
export function idTimestamp(id: string): Date {
  const body = id.split('_')[1] ?? '';
  let ms = 0;
  for (const ch of body.slice(0, 10)) ms = ms * 32 + ALPHABET.indexOf(ch);
  return new Date(ms);
}
