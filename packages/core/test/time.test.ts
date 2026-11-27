import { describe, expect, it } from 'vitest';
import { addDays, businessDateAt, financialYearLabel, isBusinessDate, weekdayIndex } from '../src/time';

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
  it('labels financial years April–March', () => {
    expect(financialYearLabel('2026-04-01')).toBe('26-27');
    expect(financialYearLabel('2027-03-31')).toBe('26-27');
    expect(financialYearLabel('2099-12-31')).toBe('99-00');
  });
});
