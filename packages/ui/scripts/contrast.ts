/**
 * WCAG contrast check for token pairs, light and dark. Fails (exit 1) below the minimum.
 * Run: pnpm --filter @dairy/ui contrast
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const css = readFileSync(fileURLToPath(new URL('../tokens.css', import.meta.url)), 'utf8');

function block(selector: RegExp): Record<string, string> {
  const m = selector.exec(css);
  if (!m) throw new Error(`block not found: ${selector}`);
  const body = css.slice(m.index + m[0].length, css.indexOf('}', m.index + m[0].length));
  return Object.fromEntries([...body.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{6})/gi)].map((x) => [x[1]!, x[2]!]));
}

const light = block(/^:root \{/m);
const dark = block(/:root\[data-theme='dark'\] \{/);

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}
export function ratio(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x! + 0.05) / (y! + 0.05);
}

// [foreground, background, minimum]: 4.5 for text, 3 for large text / UI marks.
const pairs: [string, string, number][] = [
  ['ink', 'paper', 4.5],
  ['ink', 'paper-2', 4.5],
  ['ink', 'paper-3', 4.5],
  ['ink-2', 'paper', 4.5],
  ['ink-2', 'paper-2', 4.5],
  ['on-signal', 'signal', 4.5],
  ['paper', 'ink', 4.5],
  ['on-forest', 'forest', 4.5],
  ['on-forest', 'forest-2', 4.5],
  ['ink', 'meadow', 4.5],
  ['tick', 'paper', 3],
  ['alert', 'paper', 4.5],
  ['veg', 'paper', 3],
  ['signal', 'paper', 1], // marigold is a fill; must never carry text on paper (reported for information)
];

let failed = 0;
for (const [theme, t] of [['light', light], ['dark', dark]] as const) {
  for (const [fg, bg, min] of pairs) {
    const r = ratio(t[fg]!, t[bg]!);
    const ok = r >= min;
    if (!ok) failed++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${theme.padEnd(5)} ${fg.padEnd(9)} on ${bg.padEnd(8)} ${r.toFixed(2)} (min ${min})`);
  }
}
if (failed) {
  console.error(`${failed} pair(s) below minimum`);
  process.exit(1);
}
