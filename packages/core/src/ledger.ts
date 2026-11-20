import { assertPaise } from './money';

/**
 * Double-entry wallet postings. Every movement is a group of entries summing to zero.
 * The customer account's sign is from the customer's point of view: + credit, − debit.
 */

export type LedgerAccount =
  | 'customer'
  | 'cashfree_clearing'
  | 'revenue'
  | 'promotions'
  | 'refunds'
  | 'adjustments'
  | 'deposits';

export type LedgerKind =
  | 'topup'
  | 'delivery_charge'
  | 'order_payment'
  | 'refund'
  | 'promo'
  | 'adjustment'
  | 'reversal'
  | 'deposit';

export interface Posting {
  account: LedgerAccount;
  amount: number;
}

export interface PostingGroup {
  kind: LedgerKind;
  entries: Posting[];
  /** Change to the customer's balance. */
  customerDelta: number;
}

export class LedgerError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

function positive(amount: number): number {
  assertPaise(amount);
  if (amount <= 0) throw new LedgerError('VALIDATION_FAILED', 'amount must be positive');
  return amount;
}

function group(kind: LedgerKind, customerDelta: number, counter: LedgerAccount): PostingGroup {
  return {
    kind,
    customerDelta,
    entries: [
      { account: 'customer', amount: customerDelta },
      { account: counter, amount: -customerDelta },
    ],
  };
}

export const postings = {
  topup: (amount: number) => group('topup', positive(amount), 'cashfree_clearing'),
  deliveryCharge: (amount: number) => group('delivery_charge', -positive(amount), 'revenue'),
  orderPayment: (amount: number) => group('order_payment', -positive(amount), 'revenue'),
  refund: (amount: number) => group('refund', positive(amount), 'refunds'),
  promo: (amount: number) => group('promo', positive(amount), 'promotions'),
  deposit: (amount: number) => group('deposit', -positive(amount), 'deposits'),
  adjustment: (amount: number, direction: 'credit' | 'debit') =>
    group('adjustment', direction === 'credit' ? positive(amount) : -positive(amount), 'adjustments'),
  /** Reverse an earlier group exactly. */
  reversal: (original: PostingGroup): PostingGroup => ({
    kind: 'reversal',
    customerDelta: -original.customerDelta,
    entries: original.entries.map((e) => ({ account: e.account, amount: -e.amount })),
  }),
};

export function assertBalanced(g: PostingGroup): void {
  const sum = g.entries.reduce((s, e) => s + e.amount, 0);
  if (sum !== 0) throw new LedgerError('LEDGER_UNBALANCED', `posting group sums to ${sum}`);
}

/** Can a wallet pay `charge` without going below −overdraftLimit? */
export function canCharge(balance: number, charge: number, overdraftLimit = 0): boolean {
  assertPaise(balance);
  assertPaise(charge);
  assertPaise(overdraftLimit);
  return balance - charge >= -overdraftLimit;
}

export interface WalletLimits {
  minTopup: number;
  maxTopup: number;
  maxBalance: number;
}

export const DEFAULT_WALLET_LIMITS: WalletLimits = {
  minTopup: 10_000, // ₹100
  maxTopup: 1_000_000, // ₹10,000
  maxBalance: 2_000_000, // ₹20,000
};

export function validateTopup(amount: number, balance: number, limits: WalletLimits = DEFAULT_WALLET_LIMITS): void {
  assertPaise(amount);
  if (amount < limits.minTopup || amount > limits.maxTopup) {
    throw new LedgerError('WALLET_LIMIT_EXCEEDED', 'top-up amount outside allowed range');
  }
  if (balance + amount > limits.maxBalance) {
    throw new LedgerError('WALLET_LIMIT_EXCEEDED', 'top-up would exceed the maximum wallet balance');
  }
}
