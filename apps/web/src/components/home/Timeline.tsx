import { addDays, todayIST, weekdayIndex } from '@dairy/core';
import { shortDate } from '@/lib/format';

/** Next working day (we do not pack on Sundays; weekdayIndex is Monday = 0). */
function nextWorkingDay(d: string) {
  let x = addDays(d, 1);
  while (weekdayIndex(x) === 6) x = addDays(x, 1);
  return x;
}

const ZONES = [
  { name: 'Pune', min: 1, max: 2 },
  { name: 'Rest of Maharashtra & Goa', min: 2, max: 4 },
  { name: 'Most of India', min: 3, max: 6 },
];

/** "If you order today": concrete dates instead of a three-icon process diagram. */
export function Timeline() {
  const today = todayIST();
  const packed = nextWorkingDay(today);
  return (
    <div className="grid gap-10 lg:grid-cols-12">
      <div className="lg:col-span-4">
        <h2 className="font-display text-[clamp(34px,4vw,56px)] leading-[1.02]">If you order today</h2>
        <p className="mt-4 max-w-sm text-[17px] text-ink-2">We pack the next working day, then a courier takes it from our door to yours. Exact dates for your pincode show at checkout.</p>
      </div>
      <ol className="lg:col-span-8">
        <Row when={shortDate(today)} what="You order and pay online" />
        <Row when={shortDate(packed)} what="We pack it, oldest safe batch first, and hand it to the courier" />
        {ZONES.map((z) => (
          <Row key={z.name} when={`${shortDate(addDays(packed, z.min))} – ${shortDate(addDays(packed, z.max))}`} what={`Arrives · ${z.name}`} muted />
        ))}
      </ol>
    </div>
  );
}

function Row({ when, what, muted = false }: { when: string; what: string; muted?: boolean }) {
  return (
    <li className="grid grid-cols-1 gap-1 border-t border-rule py-4 last:border-b sm:grid-cols-[14rem_1fr] sm:gap-6">
      <span className="num text-[15px]">{when}</span>
      <span className={`text-[17px] ${muted ? 'text-ink-2' : ''}`}>{what}</span>
    </li>
  );
}
