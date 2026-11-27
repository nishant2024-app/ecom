/**
 * Business time. India has a fixed UTC+05:30 offset with no daylight saving, so we
 * compute with plain UTC arithmetic instead of a timezone database.
 *
 * - A BusinessDate is a 'YYYY-MM-DD' string meaning a calendar date in IST.
 * - Instants are JS Dates (UTC).
 */

export type BusinessDate = string; // YYYY-MM-DD

export const IST_OFFSET_MINUTES = 330;
const DAY_MS = 86_400_000;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

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

/** Indian financial year label for a date, e.g. 2026-12-02 → '26-27', 2027-03-31 → '26-27'. */
export function financialYearLabel(date: BusinessDate): string {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  const start = month >= 4 ? year : year - 1;
  return `${String(start % 100).padStart(2, '0')}-${String((start + 1) % 100).padStart(2, '0')}`;
}
