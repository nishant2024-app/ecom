import { addDays, firstOpenDate, todayIST, type BusinessDate, type SlotTiming } from '@dairy/core';
import { schema as s, type DbOrTx } from '@dairy/db';
import { and, asc, eq, gte, isNull, lte, or, sql } from 'drizzle-orm';
import { AppError } from '../lib/errors';

/** Single-seller store context (multi-vendor later: resolve seller from zone/product). */

export interface SlotRow {
  id: string;
  sellerId: string;
  code: string;
  labelEn: string;
  labelHi: string;
  timing: SlotTiming;
}

let cachedSeller: { id: string; at: number } | null = null;

export async function defaultSellerId(db: DbOrTx): Promise<string> {
  if (cachedSeller && Date.now() - cachedSeller.at < 60_000) return cachedSeller.id;
  const [row] = await db.select({ id: s.sellers.id }).from(s.sellers).where(eq(s.sellers.status, 'active')).orderBy(asc(s.sellers.createdAt)).limit(1);
  if (!row) throw new AppError('SERVICE_UNAVAILABLE', 503, 'Store is not set up yet');
  cachedSeller = { id: row.id, at: Date.now() };
  return row.id;
}

export function resetStoreCache() {
  cachedSeller = null;
}

function toSlot(r: typeof s.deliverySlots.$inferSelect): SlotRow {
  return {
    id: r.id,
    sellerId: r.sellerId,
    code: r.code,
    labelEn: r.labelEn,
    labelHi: r.labelHi,
    timing: { startsAt: r.startsAt.slice(0, 5), cutoffOffsetMinutes: r.cutoffOffsetMinutes, daysOfWeek: r.daysOfWeek },
  };
}

export async function activeSlots(db: DbOrTx, sellerId: string): Promise<SlotRow[]> {
  const rows = await db
    .select()
    .from(s.deliverySlots)
    .where(and(eq(s.deliverySlots.sellerId, sellerId), eq(s.deliverySlots.active, true)))
    .orderBy(asc(s.deliverySlots.startsAt));
  return rows.map(toSlot);
}

export async function getSlot(db: DbOrTx, slotId: string): Promise<SlotRow> {
  const [row] = await db.select().from(s.deliverySlots).where(eq(s.deliverySlots.id, slotId));
  if (!row || !row.active) throw new AppError('VALIDATION_FAILED', 400, 'Unknown delivery slot');
  return toSlot(row);
}

export async function holidaySet(db: DbOrTx, sellerId: string, slotId: string, from: BusinessDate, to: BusinessDate): Promise<Set<BusinessDate>> {
  const rows = await db
    .select({ date: s.holidays.date })
    .from(s.holidays)
    .where(
      and(
        eq(s.holidays.sellerId, sellerId),
        gte(s.holidays.date, from),
        lte(s.holidays.date, to),
        or(isNull(s.holidays.slotId), eq(s.holidays.slotId, slotId)),
      ),
    );
  return new Set(rows.map((r) => r.date));
}

/** First date a customer can still change for this slot. */
export async function slotFirstOpenDate(db: DbOrTx, slot: SlotRow, now: Date): Promise<BusinessDate> {
  const today = todayIST(now);
  const holidays = await holidaySet(db, slot.sellerId, slot.id, today, addDays(today, 90));
  return firstOpenDate(slot.timing, now, holidays);
}

export async function settingsMap(db: DbOrTx, sellerId: string): Promise<Record<string, unknown>> {
  const rows = await db.select().from(s.settings).where(eq(s.settings.sellerId, sellerId));
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export function settingNumber(map: Record<string, unknown>, key: string, fallback: number): number {
  const v = map[key];
  return typeof v === 'number' ? v : fallback;
}

/** Zone containing a point, or zones for a pincode. */
export async function resolveZone(
  db: DbOrTx,
  input: { pincode?: string; location?: { lat: number; lng: number } | null },
): Promise<{ zoneId: string | null; zoneName: string | null; needsPin: boolean }> {
  if (input.location) {
    const point = sql`ST_SetSRID(ST_MakePoint(${input.location.lng}, ${input.location.lat}), 4326)::geography`;
    const [zone] = await db
      .select({ id: s.deliveryZones.id, name: s.deliveryZones.name })
      .from(s.deliveryZones)
      .where(and(eq(s.deliveryZones.status, 'active'), sql`ST_Covers(${s.deliveryZones.area}, ${point})`))
      .limit(1);
    if (zone) return { zoneId: zone.id, zoneName: zone.name, needsPin: false };
    if (!input.pincode) return { zoneId: null, zoneName: null, needsPin: false };
  }
  if (!input.pincode) return { zoneId: null, zoneName: null, needsPin: false };
  const zones = await db
    .select({ id: s.deliveryZones.id, name: s.deliveryZones.name })
    .from(s.zonePincodes)
    .innerJoin(s.deliveryZones, eq(s.deliveryZones.id, s.zonePincodes.zoneId))
    .where(and(eq(s.zonePincodes.pincode, input.pincode), eq(s.deliveryZones.status, 'active')));
  if (zones.length === 1) return { zoneId: zones[0]!.id, zoneName: zones[0]!.name, needsPin: false };
  return { zoneId: null, zoneName: null, needsPin: zones.length > 1 && !input.location };
}
