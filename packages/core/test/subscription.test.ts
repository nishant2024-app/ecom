import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  expandRange,
  itemsForDate,
  mergePauses,
  validateItems,
  validatePause,
  type SubscriptionSpec,
} from '../src/subscription';
import { addDays } from '../src/time';

const daily: SubscriptionSpec = {
  pattern: 'daily',
  status: 'active',
  startsOn: '2026-12-01',
  endsOn: null,
  items: [{ variantId: 'milk', quantity: 2 }],
};

describe('itemsForDate', () => {
  it('delivers the daily quantity', () => {
    expect(itemsForDate(daily, '2026-12-05')).toEqual([{ variantId: 'milk', quantity: 2 }]);
  });
  it('delivers nothing before start, after end, or when cancelled', () => {
    expect(itemsForDate(daily, '2026-11-30')).toEqual([]);
    expect(itemsForDate({ ...daily, endsOn: '2026-12-03' }, '2026-12-04')).toEqual([]);
    expect(itemsForDate({ ...daily, status: 'cancelled' }, '2026-12-05')).toEqual([]);
  });
  it('alternates from the anchor date', () => {
    const alt: SubscriptionSpec = { ...daily, pattern: 'alternate' };
    const days = [...expandRange(alt, '2026-12-01', '2026-12-06').keys()];
    expect(days).toEqual(['2026-12-01', '2026-12-03', '2026-12-05']);
  });
  it('uses weekday quantities, Monday first', () => {
    const wk: SubscriptionSpec = {
      ...daily,
      pattern: 'weekdays',
      items: [{ variantId: 'milk', weekdayQuantities: [1, 1, 1, 1, 1, 3, 0] }],
    };
    expect(itemsForDate(wk, '2026-12-05')).toEqual([{ variantId: 'milk', quantity: 3 }]); // Sat
    expect(itemsForDate(wk, '2026-12-06')).toEqual([]); // Sun
  });
  it('applies precedence: pause beats override beats pattern', () => {
    const spec: SubscriptionSpec = {
      ...daily,
      pauses: [{ startsOn: '2026-12-10', endsOn: '2026-12-12' }],
      overrides: new Map([
        ['2026-12-08', [{ variantId: 'milk', quantity: 5 }]],
        ['2026-12-09', []],
        ['2026-12-11', [{ variantId: 'milk', quantity: 5 }]],
      ]),
    };
    expect(itemsForDate(spec, '2026-12-08')).toEqual([{ variantId: 'milk', quantity: 5 }]);
    expect(itemsForDate(spec, '2026-12-09')).toEqual([]);
    expect(itemsForDate(spec, '2026-12-11')).toEqual([]);
    expect(itemsForDate(spec, '2026-12-13')).toEqual([{ variantId: 'milk', quantity: 2 }]);
  });
  it('skips holidays', () => {
    expect(itemsForDate(daily, '2026-12-25', new Set(['2026-12-25']))).toEqual([]);
  });

  it('property: nothing is ever delivered inside a pause', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 300 }), fc.integer({ min: 0, max: 59 }), fc.integer({ min: 0, max: 400 }), (s, len, probe) => {
        const startsOn = addDays('2026-12-01', s);
        const pause = { startsOn, endsOn: addDays(startsOn, len) };
        const date = addDays('2026-12-01', probe);
        const items = itemsForDate({ ...daily, pauses: [pause] }, date);
        const inPause = date >= pause.startsOn && date <= pause.endsOn;
        return inPause ? items.length === 0 : items.length === 1;
      }),
    );
  });
});

describe('validation', () => {
  it('validates items per pattern', () => {
    expect(() => validateItems('daily', [{ variantId: 'a', quantity: 0 }])).toThrow();
    expect(() => validateItems('weekdays', [{ variantId: 'a', weekdayQuantities: [0, 0, 0, 0, 0, 0, 0] }])).toThrow();
    expect(() => validateItems('daily', [{ variantId: 'a', quantity: 1 }, { variantId: 'a', quantity: 1 }])).toThrow();
    expect(() => validateItems('weekdays', [{ variantId: 'a', weekdayQuantities: [1, 0, 0, 0, 0, 0, 2] }])).not.toThrow();
  });
  it('validates pauses', () => {
    expect(() => validatePause({ startsOn: '2026-12-02', endsOn: '2026-12-05' }, '2026-12-03')).toThrow(/2026-12-03/);
    expect(() => validatePause({ startsOn: '2026-12-03', endsOn: '2027-02-10' }, '2026-12-03')).toThrow(/60 days/);
    expect(() => validatePause({ startsOn: '2026-12-03', endsOn: '2026-12-05' }, '2026-12-03')).not.toThrow();
  });
  it('merges overlapping and touching pauses', () => {
    expect(
      mergePauses([
        { startsOn: '2026-12-10', endsOn: '2026-12-12' },
        { startsOn: '2026-12-01', endsOn: '2026-12-03' },
        { startsOn: '2026-12-04', endsOn: '2026-12-05' },
        { startsOn: '2026-12-11', endsOn: '2026-12-15' },
      ]),
    ).toEqual([
      { startsOn: '2026-12-01', endsOn: '2026-12-05' },
      { startsOn: '2026-12-10', endsOn: '2026-12-15' },
    ]);
  });
});
