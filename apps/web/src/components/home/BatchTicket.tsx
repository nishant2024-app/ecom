import { addDays, todayIST } from '@dairy/core';

const fmt = (d: string) => new Date(`${d}T00:00:00+05:30`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }).toUpperCase();

/** Stand-in for the story photo: the batch label that goes on every jar, at poster size. */
export function BatchTicket() {
  const made = addDays(todayIST(), -3);
  const code = `GHE-A2-${made.slice(2, 4)}${made.slice(5, 7)}${made.slice(8, 10)}`;
  return (
    <div className="relative grid aspect-[4/5] place-items-center bg-forest p-8 text-on-forest">
      <div className="w-full max-w-[340px] -rotate-2 bg-paper p-6 text-ink shadow-[0_30px_40px_-24px_rgb(0_0_0_/_0.6)]">
        <div className="flex items-baseline justify-between border-b-[3px] border-ink pb-2">
          <p className="font-display text-2xl">Mulshi Dairy</p>
          <p className="label">A2 cow ghee</p>
        </div>
        <dl className="num mt-3 space-y-2 text-[15px]">
          {[
            ['Batch', code],
            ['Made on', fmt(made)],
            ['Best before', fmt(addDays(made, 274))],
            ['Net qty', '500 ml'],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 border-b border-dashed border-ink/40 pb-2">
              <dt className="text-ink-2">{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 font-serif text-[15px] italic leading-snug text-ink-2">Store in a cool, dry place. Use a dry spoon.</p>
      </div>
      <p className="label absolute bottom-6 left-8 right-8 text-on-forest/70">Printed on every jar, tin and box we ship</p>
    </div>
  );
}
