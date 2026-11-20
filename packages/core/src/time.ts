/**
 * Business time. India has a fixed UTC+05:30 offset with no daylight saving, so we
 * compute with plain UTC arithmetic instead of a timezone database.
 *
 * - A BusinessDate is a 'YYYY-MM-DD' string meaning a calendar date in IST.
 * - Instants are JS Dates (UTC).
 */

export type BusinessDate = string; // YYYY-MM-DD
export type TimeOfDay = string; // HH:mm

export const IST_OFFSET_MINUTES = 330;
const DAY_MS = 86_400_000;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export class TimeError extends Error {}

function parse(date: BusinessDate): number {
  const m = DATE_RE.exec(date);
  if (!m) throw new TimeError(`invalid business date: ${date}`);
  const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (format(ms) !== date) throw new TimeError(`invalid business date: ${date}`);
  return ms;
}

function format(utcMidnightMs: number): BusinessDate {
  return new Date(utcMidnightMs).toISOString().slice(0, 10);
}

export function isBusinessDate(value: string): boolean {
  try {
    parse(value);
    return true;
  } catch {
    return false;
  }
}

/** The IST calendar date at a given instant. */
export function businessDateAt(instant: Date): BusinessDate {
  return format(instant.getTime() + IST_OFFSET_MINUTES * 60_000).slice(0, 10);
}

export function todayIST(now: Date = new Date()): BusinessDate {
  return businessDateAt(now);
}

export function addDays(date: BusinessDate, days: number): BusinessDate {
  return format(parse(date) + days * DAY_MS);
}

/** Whole days from a to b (b - a). */
export function daysBetween(a: BusinessDate, b: BusinessDate): number {
  return Math.round((parse(b) - parse(a)) / DAY_MS);
}

/** 0 = Monday … 6 = Sunday (matches weekday_quantities order). */
export function weekdayIndex(date: BusinessDate): number {
  const jsDay = new Date(parse(date)).getUTCDay(); // 0 = Sunday
  return (jsDay + 6) % 7;
}

export function compareDates(a: BusinessDate, b: BusinessDate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function isWithin(date: BusinessDate, start: BusinessDate, end: BusinessDate | null): boolean {
  return date >= start && (end === null || date <= end);
}

/** The UTC instant of a wall-clock time in IST on a business date. */
export function istToInstant(date: BusinessDate, time: TimeOfDay): Date {
  const m = TIME_RE.exec(time);
  if (!m) throw new TimeError(`invalid time of day: ${time}`);
  const minutes = Number(m[1]) * 60 + Number(m[2]);
  return new Date(parse(date) + (minutes - IST_OFFSET_MINUTES) * 60_000);
}

export interface SlotTiming {
  /** Slot start, IST wall clock, e.g. '05:00'. */
  startsAt: TimeOfDay;
  /** Minutes relative to slot start; negative = before. -420 with 05:00 start = 22:00 previous day. */
  cutoffOffsetMinutes: number;
  /** Days the slot runs, 0 = Monday … 6 = Sunday. Empty or undefined = every day. */
  daysOfWeek?: readonly number[];
}

export function cutoffAt(date: BusinessDate, slot: SlotTiming): Date {
  return new Date(istToInstant(date, slot.startsAt).getTime() + slot.cutoffOffsetMinutes * 60_000);
}

export function isCutoffPassed(date: BusinessDate, slot: SlotTiming, now: Date = new Date()): boolean {
  return now.getTime() >= cutoffAt(date, slot).getTime();
}

export function slotRunsOn(date: BusinessDate, slot: SlotTiming): boolean {
  return !slot.daysOfWeek || slot.daysOfWeek.length === 0 || slot.daysOfWeek.includes(weekdayIndex(date));
}

/**
 * First date on which the slot runs, isn't a holiday, and whose cutoff is still in the future.
 * This is the earliest date a customer can still change.
 */
export function firstOpenDate(
  slot: SlotTiming,
  now: Date = new Date(),
  holidays: ReadonlySet<BusinessDate> = new Set(),
  searchDays = 60,
): BusinessDate {
  let date = addDays(todayIST(now), -1);
  for (let i = 0; i < searchDays; i++) {
    date = addDays(date, 1);
    if (slotRunsOn(date, slot) && !holidays.has(date) && !isCutoffPassed(date, slot, now)) return date;
  }
  throw new TimeError('no open date found for slot');
}

export function openDates(
  slot: SlotTiming,
  from: BusinessDate,
  days: number,
  now: Date = new Date(),
  holidays: ReadonlySet<BusinessDate> = new Set(),
): { date: BusinessDate; cutoffAt: Date; open: boolean }[] {
  const out: { date: BusinessDate; cutoffAt: Date; open: boolean }[] = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(from, i);
    if (!slotRunsOn(date, slot) || holidays.has(date)) continue;
    out.push({ date, cutoffAt: cutoffAt(date, slot), open: !isCutoffPassed(date, slot, now) });
  }
  return out;
}

/** All dates of a month 'YYYY-MM'. */
export function monthDates(month: string): BusinessDate[] {
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(month);
  if (!m) throw new TimeError(`invalid month: ${month}`);
  const first = `${month}-01`;
  const out: BusinessDate[] = [];
  for (let d = first; d.startsWith(month); d = addDays(d, 1)) out.push(d);
  return out;
}

/** Indian financial year label for a date, e.g. 2026-12-02 → '26-27', 2027-03-31 → '26-27'. */
export function financialYearLabel(date: BusinessDate): string {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  const start = month >= 4 ? year : year - 1;
  return `${String(start % 100).padStart(2, '0')}-${String((start + 1) % 100).padStart(2, '0')}`;
}
