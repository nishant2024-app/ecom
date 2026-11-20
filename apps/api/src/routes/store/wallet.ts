import { addDays, expandRange, todayIST } from '@dairy/core';
import { schema as s } from '@dairy/db';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import { and, desc, eq, lt } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { notFound } from '../../lib/errors';
import { CursorQuery, Money, Nullable, PageInfo, decodeCursor, encodeCursor, money } from '../../lib/schemas';
import { requireAuth } from '../../plugins/auth';
import { loadSubscriptions, variantInfo } from '../../services/subscriptions';

const LedgerEntry = Type.Object({
  id: Type.String(),
  kind: Type.String(),
  amount: Money,
  balanceAfter: Nullable(Money),
  memo: Type.String(),
  reference: Type.Object({ type: Type.String(), id: Type.String() }),
  createdAt: Type.String(),
});

export default async function walletRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<TypeBoxTypeProvider>();
  const { db } = app.deps.db;
  const cfg = { auth: 'customer' as const };

  async function walletFor(customerId: string) {
    const [w] = await db.select().from(s.wallets).where(eq(s.wallets.customerId, customerId));
    if (!w) throw notFound('Wallet');
    return w;
  }

  app.get(
    '/wallet',
    {
      config: cfg,
      schema: {
        tags: ['Wallet'],
        summary: 'Balance, projection and low-balance flag',
        response: {
          200: Type.Object({
            balance: Money,
            overdraftLimit: Money,
            projected: Type.Object({ next7Days: Money, runsOutOn: Nullable(Type.String()) }),
            lowBalance: Type.Boolean(),
          }),
        },
      },
    },
    async (req) => {
      const customerId = requireAuth(req).sub;
      const wallet = await walletFor(customerId);
      const today = todayIST(app.deps.now());
      const from = addDays(today, 1);
      const to = addDays(today, 30);
      const rows = await db.select().from(s.subscriptions).where(and(eq(s.subscriptions.customerId, customerId), eq(s.subscriptions.status, 'active')));
      const subs = await loadSubscriptions(db, rows, { from, to });
      const info = await variantInfo(db, subs.flatMap((x) => x.items.map((i) => i.variantId)));
      const daily = new Map<string, number>();
      for (const sub of subs) {
        for (const [date, items] of expandRange(sub.spec, from, to)) {
          const cost = items.reduce((sum, i) => sum + (info.get(i.variantId)?.subscriptionPricePaise ?? 0) * i.quantity, 0);
          daily.set(date, (daily.get(date) ?? 0) + cost);
        }
      }
      let balance = wallet.balancePaise;
      let runsOutOn: string | null = null;
      let next7 = 0;
      for (let d = from, i = 0; d <= to; d = addDays(d, 1), i++) {
        const cost = daily.get(d) ?? 0;
        if (i < 7) next7 += cost;
        balance -= cost;
        if (runsOutOn === null && balance < -wallet.overdraftLimitPaise) runsOutOn = d;
      }
      const threshold = wallet.lowBalanceThresholdPaise ?? Math.round((next7 * 3) / 7);
      return {
        balance: money(wallet.balancePaise),
        overdraftLimit: money(wallet.overdraftLimitPaise),
        projected: { next7Days: money(next7), runsOutOn },
        lowBalance: next7 > 0 && wallet.balancePaise < threshold,
      };
    },
  );

  app.get(
    '/wallet/ledger',
    {
      config: cfg,
      schema: {
        tags: ['Wallet'],
        summary: 'Ledger entries, newest first',
        querystring: CursorQuery,
        response: { 200: Type.Object({ data: Type.Array(LedgerEntry), page: PageInfo }) },
      },
    },
    async (req) => {
      const wallet = await walletFor(requireAuth(req).sub);
      const limit = req.query.limit ?? 20;
      const after = decodeCursor<{ id: string }>(req.query.cursor)?.id;
      const rows = await db
        .select()
        .from(s.walletLedger)
        .where(and(eq(s.walletLedger.walletId, wallet.id), eq(s.walletLedger.account, 'customer'), ...(after ? [lt(s.walletLedger.id, after)] : [])))
        .orderBy(desc(s.walletLedger.id))
        .limit(limit + 1);
      const page = rows.slice(0, limit);
      return {
        data: page.map((r) => ({
          id: r.id,
          kind: r.kind,
          amount: money(r.amountPaise),
          balanceAfter: r.balanceAfterPaise === null ? null : money(r.balanceAfterPaise),
          memo: r.memo,
          reference: { type: r.referenceType, id: r.referenceId },
          createdAt: r.createdAt.toISOString(),
        })),
        page: { nextCursor: rows.length > limit ? encodeCursor({ id: page.at(-1)!.id }) : null, hasMore: rows.length > limit },
      };
    },
  );
}
