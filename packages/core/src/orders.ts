/**
 * Order lifecycle for shipped orders. Every transition is validated here and recorded as an order event.
 *
 *   pending_payment ──paid──▶ confirmed ──pack──▶ packed ──ship──▶ shipped ──deliver──▶ delivered
 *        │                      │                  │
 *        └─expire/fail─▶ cancelled ◀──cancel───────┘   (refund issued when it was paid)
 */
export const ORDER_STATUSES = ['pending_payment', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled', 'refunded'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export type OrderAction = 'pay' | 'pack' | 'ship' | 'deliver' | 'cancel' | 'expire' | 'refund';

const TRANSITIONS: Record<OrderAction, { from: readonly OrderStatus[]; to: OrderStatus }> = {
  pay: { from: ['pending_payment'], to: 'confirmed' },
  pack: { from: ['confirmed'], to: 'packed' },
  ship: { from: ['packed'], to: 'shipped' },
  deliver: { from: ['shipped'], to: 'delivered' },
  cancel: { from: ['pending_payment', 'confirmed', 'packed'], to: 'cancelled' },
  expire: { from: ['pending_payment'], to: 'cancelled' },
  refund: { from: ['delivered', 'cancelled'], to: 'refunded' },
};

export class OrderStateError extends Error {
  constructor(
    public readonly from: OrderStatus,
    public readonly action: OrderAction,
  ) {
    super(`Cannot ${action} an order that is ${from.replace('_', ' ')}`);
  }
}

export function canTransition(from: OrderStatus, action: OrderAction): boolean {
  return TRANSITIONS[action].from.includes(from);
}

export function nextStatus(from: OrderStatus, action: OrderAction): OrderStatus {
  if (!canTransition(from, action)) throw new OrderStateError(from, action);
  return TRANSITIONS[action].to;
}

/** Customers may cancel until the order is packed. */
export function customerCanCancel(status: OrderStatus): boolean {
  return status === 'pending_payment' || status === 'confirmed';
}

/** Statuses in which stock is held for the order (reserved, not yet shipped). */
export function holdsReservation(status: OrderStatus): boolean {
  return status === 'pending_payment' || status === 'confirmed' || status === 'packed';
}

/** Human order number: D-261202-0042 (date in IST + daily sequence). */
export function orderNumber(businessDate: string, sequence: number): string {
  return `D-${businessDate.slice(2).replaceAll('-', '')}-${String(sequence).padStart(4, '0')}`;
}
