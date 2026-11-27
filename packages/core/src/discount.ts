/**
 * Spread a discount across order lines in proportion to their value, to the paisa: the parts always add up to
 * exactly the discount, and no line goes below zero. Used to recompute GST on the discounted price of each line.
 */
export function allocateDiscount(lineTotalsPaise: readonly number[], discountPaise: number): number[] {
  const total = lineTotalsPaise.reduce((a, b) => a + b, 0);
  if (discountPaise <= 0 || total <= 0) return lineTotalsPaise.map(() => 0);
  const discount = Math.min(discountPaise, total);
  const parts = lineTotalsPaise.map((t, i) => {
    const exact = (t * discount) / total;
    return { i, floor: Math.floor(exact), frac: exact - Math.floor(exact) };
  });
  let left = discount - parts.reduce((a, p) => a + p.floor, 0);
  // Largest remainders first; ties go to the earlier line so the result is deterministic.
  for (const p of [...parts].sort((a, b) => b.frac - a.frac || a.i - b.i)) {
    if (left <= 0) break;
    p.floor += 1;
    left -= 1;
  }
  return parts.map((p) => p.floor);
}

/** "SAVE10" → "SAVE10": upper-case, no spaces; the form customers type and staff define. */
export const normalizeCouponCode = (code: string) => code.trim().toUpperCase().replace(/\s+/g, '');
export const isCouponCode = (code: string) => /^[A-Z0-9_-]{3,24}$/.test(code);
