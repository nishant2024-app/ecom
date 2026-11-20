import type { ShippingZone } from '@dairy/core';
import { schema as s, type DbOrTx } from '@dairy/db';
import { asc, eq } from 'drizzle-orm';
import { AppError } from '../lib/errors';

/** Single-seller store context (multi-vendor later: resolve the seller per product). */
let cachedSeller: { id: string; at: number } | null = null;
let cachedZones: { zones: ShippingZone[]; at: number } | null = null;

export async function defaultSellerId(db: DbOrTx): Promise<string> {
  if (cachedSeller && Date.now() - cachedSeller.at < 60_000) return cachedSeller.id;
  const [row] = await db.select({ id: s.sellers.id }).from(s.sellers).where(eq(s.sellers.status, 'active')).orderBy(asc(s.sellers.createdAt)).limit(1);
  if (!row) throw new AppError('SERVICE_UNAVAILABLE', 503, 'Store is not set up yet');
  cachedSeller = { id: row.id, at: Date.now() };
  return row.id;
}

export async function shippingZones(db: DbOrTx): Promise<ShippingZone[]> {
  if (cachedZones && Date.now() - cachedZones.at < 30_000) return cachedZones.zones;
  const rows = await db.select().from(s.shippingZones).orderBy(asc(s.shippingZones.sort));
  const zones = rows.map((z) => ({
    code: z.code,
    name: z.name,
    pincodePrefixes: z.pincodePrefixes,
    feePaise: z.feePaise,
    freeAbovePaise: z.freeAbovePaise,
    includedGrams: z.includedGrams,
    perExtraKgPaise: z.perExtraKgPaise,
    etaMinDays: z.etaMinDays,
    etaMaxDays: z.etaMaxDays,
    serviceable: z.serviceable,
  }));
  cachedZones = { zones, at: Date.now() };
  return zones;
}

export function resetStoreCache() {
  cachedSeller = null;
  cachedZones = null;
}

export async function settingsMap(db: DbOrTx, sellerId: string): Promise<Record<string, unknown>> {
  const rows = await db.select().from(s.settings).where(eq(s.settings.sellerId, sellerId));
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export function settingNumber(map: Record<string, unknown>, key: string, fallback: number): number {
  const v = map[key];
  return typeof v === 'number' ? v : fallback;
}
