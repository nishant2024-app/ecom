/**
 * Net quantity from a pack-size label, for unit pricing ("₹23 per 100 ml").
 * Understands "500 ml", "1 L tin", "6 × 180 ml", "250 g box", "1 kg", "1.5 L". Returns null if unclear.
 */
export interface NetQuantity {
  /** Total in millilitres or grams. */
  amount: number;
  unit: 'ml' | 'g';
}

export function parseNetQuantity(label: string): NetQuantity | null {
  const s = label.toLowerCase().replace(/,/g, '').replace(/\s+/g, ' ');
  const m = /(?:(\d+)\s*[x×]\s*)?(\d+(?:\.\d+)?)\s*(ml|l|ltr|litre|liter|g|gm|kg)\b/.exec(s);
  if (!m) return null;
  const count = m[1] ? Number(m[1]) : 1;
  const value = Number(m[2]);
  const unit = m[3]!;
  if (!(value > 0) || !(count > 0)) return null;
  const isVolume = ['ml', 'l', 'ltr', 'litre', 'liter'].includes(unit);
  const factor = unit === 'l' || unit === 'ltr' || unit === 'litre' || unit === 'liter' || unit === 'kg' ? 1000 : 1;
  return { amount: Math.round(count * value * factor), unit: isVolume ? 'ml' : 'g' };
}

/** Price per 100 ml / 100 g in paise (rounded), or null when the pack size can't be read. */
export function unitPrice(pricePaise: number, packSize: string): { paise: number; per: '100 ml' | '100 g' } | null {
  const q = parseNetQuantity(packSize);
  if (!q || q.amount <= 0) return null;
  return { paise: Math.round((pricePaise * 100) / q.amount), per: q.unit === 'ml' ? '100 ml' : '100 g' };
}
