import { useState } from 'react';
import { day, rupees, type Money } from '../lib/format';

interface Point {
  date: string;
  revenue: Money;
  orders: number;
}

function niceStep(raw: number): number {
  const pow = 10 ** Math.floor(Math.log10(Math.max(1, raw)));
  const n = raw / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
}

const axisMoney = (paise: number) => {
  const r = paise / 100;
  return r >= 1000 ? `₹${(r / 1000).toLocaleString('en-IN', { maximumFractionDigits: 1 })}k` : `₹${r}`;
};

/**
 * Single-series column chart of daily revenue. One hue (the title names it, so no legend),
 * 4px rounded tops anchored to the baseline, 2px gaps, recessive grid, a hover/focus tooltip
 * per bar and a table for screen readers.
 */
export function RevenueChart({ series }: { series: Point[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 640;
  const H = 210;
  const pad = { l: 48, r: 8, t: 14, b: 26 };
  const max = Math.max(1, ...series.map((p) => p.revenue.amount));
  const step = niceStep(max / 4);
  const top = Math.ceil(max / step) * step;
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const bw = iw / Math.max(1, series.length);
  const y = (v: number) => pad.t + ih - (v / top) * ih;
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
  const hp = hover !== null ? series[hover] : null;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Daily revenue, paid orders">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--rule)" strokeWidth={t === 0 ? 1 : 0.6} />
            <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--ink-3)" style={{ fontFamily: 'var(--font-mono)' }}>
              {axisMoney(t)}
            </text>
          </g>
        ))}
        {series.map((p, i) => {
          const h = Math.max(0, y(0) - y(p.revenue.amount));
          const x = pad.l + i * bw + 1;
          const w = Math.max(1, bw - 2);
          const r = Math.min(4, h, w / 2);
          return (
            <g
              key={p.date}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              tabIndex={0}
              aria-label={`${day(p.date)}: ${rupees(p.revenue.amount)}, ${p.orders} orders`}
            >
              <rect x={pad.l + i * bw} y={pad.t} width={bw} height={ih} fill="transparent" />
              {h > 0 && (
                <path
                  d={`M${x} ${y(0)} V${y(0) - h + r} q0 -${r} ${r} -${r} H${x + w - r} q${r} 0 ${r} ${r} V${y(0)} Z`}
                  fill="var(--chart)"
                  opacity={hover === null || hover === i ? 1 : 0.45}
                />
              )}
              {(series.length <= 14 || i % Math.ceil(series.length / 10) === 0) && (
                <text x={pad.l + i * bw + bw / 2} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--ink-3)">
                  {day(p.date)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {hp && hover !== null && (
        <div
          className="pointer-events-none absolute rounded-3 border border-rule bg-paper px-3 py-2 text-sm shadow-float"
          style={{ left: `${((pad.l + hover * bw + bw / 2) / W) * 100}%`, top: 0, transform: 'translateX(-50%)' }}
        >
          <p className="text-ink-2">{day(hp.date)}</p>
          <p className="num text-base">{rupees(hp.revenue.amount)}</p>
          <p className="text-xs text-ink-2">{hp.orders} paid orders</p>
        </div>
      )}
      <table className="sr-only">
        <caption>Daily revenue</caption>
        <thead>
          <tr>
            <th>Date</th>
            <th>Revenue</th>
            <th>Orders</th>
          </tr>
        </thead>
        <tbody>
          {series.map((p) => (
            <tr key={p.date}>
              <td>{p.date}</td>
              <td>{rupees(p.revenue.amount)}</td>
              <td>{p.orders}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
