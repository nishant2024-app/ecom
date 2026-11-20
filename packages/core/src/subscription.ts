import { addDays, daysBetween, isWithin, weekdayIndex, type BusinessDate } from './time';

export type SubscriptionPattern = 'daily' | 'alternate' | 'weekdays';
export type SubscriptionStatus = 'active' | 'cancelled';

export interface SubscriptionItemSpec {
  variantId: string;
  /** Used by daily and alternate patterns. */
  quantity?: number;
  /** Used by the weekdays pattern: 7 integers, Monday first. */
  weekdayQuantities?: readonly number[];
}

export interface DateRange {
  startsOn: BusinessDate;
  endsOn: BusinessDate;
}

export interface ItemQuantity {
  variantId: string;
  quantity: number;
}

export interface SubscriptionSpec {
  pattern: SubscriptionPattern;
  status: SubscriptionStatus;
  startsOn: BusinessDate;
  endsOn: BusinessDate | null;
  /** Day 0 for the alternate pattern. Defaults to startsOn. */
  anchorDate?: BusinessDate;
  items: readonly SubscriptionItemSpec[];
  pauses?: readonly DateRange[];
  /** Per-date replacements. An empty array skips the day. */
  overrides?: ReadonlyMap<BusinessDate, readonly ItemQuantity[]>;
}

export class SubscriptionError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export const MAX_QUANTITY_PER_ITEM = 20;
export const MAX_PAUSE_DAYS = 60;

export function validateItems(pattern: SubscriptionPattern, items: readonly SubscriptionItemSpec[]): void {
  if (items.length === 0) throw new SubscriptionError('VALIDATION_FAILED', 'at least one item is required');
  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.variantId)) {
      throw new SubscriptionError('VALIDATION_FAILED', `duplicate variant ${item.variantId}`);
    }
    seen.add(item.variantId);
    if (pattern === 'weekdays') {
      const wq = item.weekdayQuantities;
      if (!wq || wq.length !== 7 || wq.some((q) => !Number.isInteger(q) || q < 0 || q > MAX_QUANTITY_PER_ITEM)) {
        throw new SubscriptionError('VALIDATION_FAILED', 'weekdayQuantities must be 7 integers between 0 and 20');
      }
      if (wq.every((q) => q === 0)) {
        throw new SubscriptionError('VALIDATION_FAILED', 'weekdayQuantities must deliver on at least one day');
      }
    } else {
      const q = item.quantity;
      if (q === undefined || !Number.isInteger(q) || q < 1 || q > MAX_QUANTITY_PER_ITEM) {
        throw new SubscriptionError('VALIDATION_FAILED', 'quantity must be an integer between 1 and 20');
      }
    }
  }
}

function patternQuantity(spec: SubscriptionSpec, item: SubscriptionItemSpec, date: BusinessDate): number {
  switch (spec.pattern) {
    case 'daily':
      return item.quantity ?? 0;
    case 'alternate': {
      const offset = daysBetween(spec.anchorDate ?? spec.startsOn, date);
      return offset % 2 === 0 ? (item.quantity ?? 0) : 0;
    }
    case 'weekdays':
      return item.weekdayQuantities?.[weekdayIndex(date)] ?? 0;
  }
}

export function isPaused(spec: SubscriptionSpec, date: BusinessDate): boolean {
  return (spec.pauses ?? []).some((p) => isWithin(date, p.startsOn, p.endsOn));
}

/**
 * What a subscription delivers on a date, following docs/06-business-rules.md:
 * inactive → nothing; paused → nothing; holiday → nothing; override → override items;
 * otherwise the pattern. Zero quantities are dropped.
 */
export function itemsForDate(
  spec: SubscriptionSpec,
  date: BusinessDate,
  holidays: ReadonlySet<BusinessDate> = new Set(),
): ItemQuantity[] {
  if (spec.status !== 'active') return [];
  if (!isWithin(date, spec.startsOn, spec.endsOn)) return [];
  if (isPaused(spec, date)) return [];
  if (holidays.has(date)) return [];
  const override = spec.overrides?.get(date);
  if (override) return override.filter((i) => i.quantity > 0).map((i) => ({ ...i }));
  return spec.items
    .map((item) => ({ variantId: item.variantId, quantity: patternQuantity(spec, item, date) }))
    .filter((i) => i.quantity > 0);
}

export function expandRange(
  spec: SubscriptionSpec,
  from: BusinessDate,
  to: BusinessDate,
  holidays: ReadonlySet<BusinessDate> = new Set(),
): Map<BusinessDate, ItemQuantity[]> {
  const out = new Map<BusinessDate, ItemQuantity[]>();
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const items = itemsForDate(spec, d, holidays);
    if (items.length > 0) out.set(d, items);
  }
  return out;
}

/** A new pause must start on or after the first still-open date and last at most 60 days. */
export function validatePause(pause: DateRange, firstOpen: BusinessDate): void {
  if (pause.endsOn < pause.startsOn) {
    throw new SubscriptionError('VALIDATION_FAILED', 'pause must end on or after its start');
  }
  if (pause.startsOn < firstOpen) {
    throw new SubscriptionError('CUTOFF_PASSED', `pauses can start from ${firstOpen}`);
  }
  if (daysBetween(pause.startsOn, pause.endsOn) + 1 > MAX_PAUSE_DAYS) {
    throw new SubscriptionError('VALIDATION_FAILED', `a pause can be at most ${MAX_PAUSE_DAYS} days`);
  }
}

/** Merge overlapping or touching pauses for display. */
export function mergePauses(pauses: readonly DateRange[]): DateRange[] {
  const sorted = [...pauses].sort((a, b) => (a.startsOn < b.startsOn ? -1 : 1));
  const out: DateRange[] = [];
  for (const p of sorted) {
    const last = out.at(-1);
    if (last && p.startsOn <= addDays(last.endsOn, 1)) {
      if (p.endsOn > last.endsOn) last.endsOn = p.endsOn;
    } else {
      out.push({ ...p });
    }
  }
  return out;
}

/** Rough monthly estimate (30 days from a date) in paise, given unit prices per variant. */
export function estimateMonthly(
  spec: SubscriptionSpec,
  from: BusinessDate,
  unitPrice: (variantId: string) => number,
): number {
  let total = 0;
  for (const items of expandRange(spec, from, addDays(from, 29)).values()) {
    for (const i of items) total += unitPrice(i.variantId) * i.quantity;
  }
  return total;
}
