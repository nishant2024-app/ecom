import { addDays, type BusinessDate } from './time';

export interface BatchStock {
  id: string;
  expiresOn: BusinessDate;
  /** on_hand − reserved */
  available: number;
}

export interface Allocation {
  batchId: string;
  quantity: number;
}

export interface AllocationResult {
  allocations: Allocation[];
  shortfall: number;
}

/**
 * First-expiry-first-out. Skips batches that would expire before the customer has
 * `minShelfDays` of life left after delivery.
 */
export function allocateFefo(batches: readonly BatchStock[], quantity: number, deliveryDate: BusinessDate, minShelfDays = 1): AllocationResult {
  if (!Number.isInteger(quantity) || quantity < 0) throw new RangeError('quantity must be a non-negative integer');
  const mustLastUntil = addDays(deliveryDate, minShelfDays);
  const usable = batches.filter((b) => b.available > 0 && b.expiresOn >= mustLastUntil).sort((a, b) => (a.expiresOn === b.expiresOn ? (a.id < b.id ? -1 : 1) : a.expiresOn < b.expiresOn ? -1 : 1));

  let remaining = quantity;
  const allocations: Allocation[] = [];
  for (const b of usable) {
    if (remaining === 0) break;
    const take = Math.min(b.available, remaining);
    allocations.push({ batchId: b.id, quantity: take });
    remaining -= take;
  }
  return { allocations, shortfall: remaining };
}

/** Units to produce: required + buffer − usable stock (never negative). */
export function productionNeed(
  required: number,
  usableStock: number,
  bufferBps = 500,
): {
  required: number;
  buffer: number;
  inStock: number;
  toProduce: number;
} {
  const buffer = Math.ceil((required * bufferBps) / 10000);
  return { required, buffer, inStock: usableStock, toProduce: Math.max(0, required + buffer - usableStock) };
}
