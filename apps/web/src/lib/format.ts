export const shortDate = (iso: string) => new Date(iso.length === 10 ? `${iso}T00:00:00+05:30` : iso).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });

export const dateTime = (iso: string) => new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });

export function etaText(earliest: string, latest: string) {
  return earliest === latest ? shortDate(earliest) : `${shortDate(earliest)} – ${shortDate(latest)}`;
}

/** Shelf life as people say it: "9 months", "6 months", "30 days". */
export function shelfLife(days: number) {
  if (days >= 60) return `${Math.round(days / 30.4)} months`;
  return `${days} days`;
}

export const STATUS_LABEL: Record<string, string> = {
  pending_payment: 'Awaiting payment',
  confirmed: 'Confirmed',
  packed: 'Packed',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
};
