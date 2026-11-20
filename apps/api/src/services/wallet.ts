import { assertBalanced, newId, type PostingGroup } from '@dairy/core';
import { schema as s, type DbOrTx } from '@dairy/db';
import { and, eq } from 'drizzle-orm';

/**
 * Post a ledger group and update the cached balance in the same transaction.
 * Idempotent: a second post for the same (kind, reference) is ignored and returns null.
 * Must be called inside a transaction.
 */
export async function postToWallet(
  tx: DbOrTx,
  walletId: string,
  group: PostingGroup,
  ref: { type: string; id: string },
  memo: string,
  actor: { type: string; id?: string | null } = { type: 'system' },
): Promise<{ balanceAfter: number; ledgerId: string } | null> {
  assertBalanced(group);
  const [wallet] = await tx
    .select({ balance: s.wallets.balancePaise })
    .from(s.wallets)
    .where(eq(s.wallets.id, walletId))
    .for('update');
  if (!wallet) throw new Error(`wallet ${walletId} not found`);

  // The wallet row lock serialises posts per wallet, so check-then-insert is safe.
  const [already] = await tx
    .select({ id: s.walletLedger.id })
    .from(s.walletLedger)
    .where(
      and(
        eq(s.walletLedger.kind, group.kind),
        eq(s.walletLedger.referenceType, ref.type),
        eq(s.walletLedger.referenceId, ref.id),
        eq(s.walletLedger.account, 'customer'),
      ),
    );
  if (already) return null;

  const balanceAfter = wallet.balance + group.customerDelta;
  const groupId = newId('txg');
  const customerEntryId = newId('txn');
  await tx.insert(s.walletLedger).values(
    group.entries.map((e) => ({
      id: e.account === 'customer' ? customerEntryId : newId('txn'),
      walletId,
      entryGroupId: groupId,
      account: e.account,
      amountPaise: e.amount,
      balanceAfterPaise: e.account === 'customer' ? balanceAfter : null,
      kind: group.kind,
      referenceType: ref.type,
      referenceId: ref.id,
      memo,
      createdByType: actor.type,
      createdById: actor.id ?? null,
    })),
  );
  await tx.update(s.wallets).set({ balancePaise: balanceAfter }).where(eq(s.wallets.id, walletId));
  return { balanceAfter, ledgerId: customerEntryId };
}
