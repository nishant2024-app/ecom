'use client';

import { useRef, useState, type KeyboardEvent } from 'react';
import { cn } from './cn';

export interface MilkCardItem {
  variantId: string;
  name: string;
  quantity: number;
}

export interface MilkCardDay {
  date: string;
  state: string;
  items: MilkCardItem[];
  editable: boolean;
  cutoffAt?: string | null;
}

export interface MilkCardProps {
  month: string; // YYYY-MM
  today: string; // YYYY-MM-DD
  days: MilkCardDay[];
  onSelect?: (day: MilkCardDay) => void;
  language?: 'en' | 'hi';
  className?: string;
}

const WEEKDAYS = {
  en: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  hi: ['सोम', 'मंगल', 'बुध', 'गुरु', 'शुक्र', 'शनि', 'रवि'],
};
const WEEKDAYS_LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const STATE_LABEL: Record<string, string> = {
  planned: 'planned',
  scheduled: 'locked for delivery',
  packed: 'packed',
  out_for_delivery: 'out for delivery',
  delivered: 'delivered',
  not_available: 'not delivered, nobody home',
  refused: 'refused',
  missed: 'missed',
  skipped_low_balance: 'skipped, low wallet balance',
  paused: 'paused',
  holiday: 'no delivery, holiday',
  none: 'no delivery',
};

function mark(state: string): string {
  switch (state) {
    case 'delivered':
      return '✓';
    case 'paused':
    case 'holiday':
      return '—';
    case 'missed':
    case 'not_available':
    case 'refused':
    case 'skipped_low_balance':
      return '×';
    default:
      return '';
  }
}

/** Monday-first weekday index of a YYYY-MM-DD date. */
function weekday(date: string): number {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

function cellLabel(day: MilkCardDay): string {
  const [y, m, d] = day.date.split('-').map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
  const items = day.items.length ? day.items.map((i) => `${i.quantity} ${i.name}`).join(', ') : 'nothing';
  const cutoff = day.editable && day.cutoffAt
    ? `, editable until ${new Date(day.cutoffAt).toLocaleString('en-IN', { weekday: 'long', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' })}`
    : '';
  return `${date}: ${items}, ${STATE_LABEL[day.state] ?? day.state}${cutoff}`;
}

/**
 * The milk card: a month grid of deliveries, modelled on the paper calendar households keep.
 * ARIA grid with roving focus; arrow keys move by day and week, Enter/Space opens a day.
 */
export function MilkCard({ month, today, days, onSelect, language = 'en', className }: MilkCardProps) {
  const lead = days.length ? weekday(days[0]!.date) : 0;
  const cells: (MilkCardDay | null)[] = [...Array<null>(lead).fill(null), ...days];
  while (cells.length % 7) cells.push(null);
  const rows = Array.from({ length: cells.length / 7 }, (_, r) => cells.slice(r * 7, r * 7 + 7));

  const initial = Math.max(0, days.findIndex((d) => d.date >= today));
  const [focus, setFocus] = useState(initial);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const move = (to: number) => {
    const next = Math.min(days.length - 1, Math.max(0, to));
    setFocus(next);
    refs.current[next]?.focus();
  };
  const onKey = (e: KeyboardEvent, index: number) => {
    const delta = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 7, ArrowUp: -7 }[e.key];
    if (delta !== undefined) {
      e.preventDefault();
      move(index + delta);
    } else if (e.key === 'Home') {
      e.preventDefault();
      move(index - weekday(days[index]!.date));
    } else if (e.key === 'End') {
      e.preventDefault();
      move(index + 6 - weekday(days[index]!.date));
    }
  };

  return (
    <div role="grid" aria-label={`Deliveries for ${month}`} className={cn('w-full select-none', className)}>
      <div role="row" className="grid grid-cols-7 rule-b">
        {WEEKDAYS[language].map((w, i) => (
          <div role="columnheader" key={w} aria-label={WEEKDAYS_LONG[i]} className="py-2 text-center text-xs uppercase tracking-wider text-ink-2">
            {w}
          </div>
        ))}
      </div>
      {rows.map((row, r) => (
        <div role="row" key={r} className="grid grid-cols-7">
          {row.map((day, c) => {
            if (!day) return <div role="gridcell" key={c} className="min-h-[68px] border-b border-r border-rule bg-paper first:border-l" />;
            const index = days.indexOf(day);
            const isToday = day.date === today;
            const nextOpen = day.editable && days.findIndex((d) => d.editable) === index;
            const qty = day.items.reduce((n, i) => n + i.quantity, 0);
            const past = day.date < today;
            return (
              <div role="gridcell" key={day.date} className="border-b border-r border-rule first:border-l">
                <button
                  ref={(el) => {
                    refs.current[index] = el;
                  }}
                  type="button"
                  tabIndex={index === focus ? 0 : -1}
                  aria-label={cellLabel(day)}
                  onFocus={() => setFocus(index)}
                  onKeyDown={(e) => onKey(e, index)}
                  onClick={() => onSelect?.(day)}
                  className={cn(
                    'relative flex h-full min-h-[68px] w-full flex-col items-start justify-between p-2 text-left transition-colors duration-[var(--dur-2)] ease-std',
                    nextOpen ? 'bg-signal text-on-signal' : day.editable ? 'hover:bg-paper-2' : 'bg-paper',
                    past && day.state !== 'delivered' && 'text-ink-3',
                  )}
                >
                  <span className={cn('num text-xs', isToday && 'font-medium underline underline-offset-4')}>{Number(day.date.slice(8))}</span>
                  <span className="flex w-full items-end justify-between">
                    <span className="num text-lg leading-none">{qty > 0 ? `${qty}×` : ''}</span>
                    <span
                      aria-hidden
                      className={cn(
                        'text-base leading-none',
                        day.state === 'delivered' && 'text-tick',
                        ['missed', 'not_available', 'refused', 'skipped_low_balance'].includes(day.state) && 'text-alert',
                      )}
                    >
                      {mark(day.state)}
                    </span>
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
