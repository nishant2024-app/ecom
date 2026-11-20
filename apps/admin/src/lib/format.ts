export interface Money {
  amount: number;
  currency: 'INR';
}
export const rupees = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: paise % 100 ? 2 : 0, minimumFractionDigits: paise % 100 ? 2 : 0 })}`;
export const when = (iso: string) => new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });
export const day = (iso: string) => new Date(iso.length === 10 ? `${iso}T00:00:00+05:30` : iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
export const STATUS: Record<string, string> = {
  pending_payment: 'Awaiting payment',
  confirmed: 'To pack',
  packed: 'To ship',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
};
