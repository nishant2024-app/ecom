import { describe, expect, it } from 'vitest';
import {
  addDays,
  businessDateAt,
  cutoffAt,
  financialYearLabel,
  firstOpenDate,
  isBusinessDate,
  isCutoffPassed,
  monthDates,
  openDates,
  weekdayIndex,
} from '../src/time';

const morning = { startsAt: '05:00', cutoffOffsetMinutes: -420 }; // cutoff 22:00 previous day

describe('business dates', () => {
  it('uses IST, not UTC, for the calendar date', () => {
    expect(businessDateAt(new Date('2026-12-01T18:29:59Z'))).toBe('2026-12-01');
    expect(businessDateAt(new Date('2026-12-01T18:30:00Z'))).toBe('2026-12-02');
  });
  it('validates dates', () => {
    expect(isBusinessDate('2026-02-29')).toBe(false);
    expect(isBusinessDate('2028-02-29')).toBe(true);
    expect(isBusinessDate('2026-13-01')).toBe(false);
  });
  it('adds days across month and year ends', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29');
  });
  it('indexes weekdays Monday first', () => {
    expect(weekdayIndex('2026-11-30')).toBe(0); // Monday
    expect(weekdayIndex('2026-12-06')).toBe(6); // Sunday
  });
  it('lists month dates', () => {
    expect(monthDates('2026-02')).toHaveLength(28);
    expect(monthDates('2028-02').at(-1)).toBe('2028-02-29');
  });
  it('labels financial years April–March', () => {
    expect(financialYearLabel('2026-04-01')).toBe('26-27');
    expect(financialYearLabel('2027-03-31')).toBe('26-27');
    expect(financialYearLabel('2099-12-31')).toBe('99-00');
  });
});

describe('cutoffs', () => {
  it('puts the morning cutoff at 22:00 IST the night before', () => {
    expect(cutoffAt('2026-12-02', morning).toISOString()).toBe('2026-12-01T16:30:00.000Z');
  });
  it('knows when the cutoff has passed', () => {
    expect(isCutoffPassed('2026-12-02', morning, new Date('2026-12-01T16:29:59Z'))).toBe(false);
    expect(isCutoffPassed('2026-12-02', morning, new Date('2026-12-01T16:30:00Z'))).toBe(true);
  });
  it('finds the first open date', () => {
    expect(firstOpenDate(morning, new Date('2026-12-01T10:00:00Z'))).toBe('2026-12-02'); // 15:30 IST
    expect(firstOpenDate(morning, new Date('2026-12-01T17:00:00Z'))).toBe('2026-12-03'); // 22:30 IST
  });
  it('skips holidays and non-slot days', () => {
    const now = new Date('2026-12-01T10:00:00Z');
    expect(firstOpenDate(morning, now, new Set(['2026-12-02']))).toBe('2026-12-03');
    const weekdaysOnly = { ...morning, daysOfWeek: [0, 1, 2, 3, 4] };
    const dates = openDates(weekdaysOnly, '2026-12-05', 3, now).map((d) => d.date);
    expect(dates).toEqual(['2026-12-07']); // Sat, Sun skipped
  });
});
