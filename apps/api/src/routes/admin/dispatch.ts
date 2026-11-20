import { newId } from '@dairy/core';
import { schema as s } from '@dairy/db';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import { and, desc, eq, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { AppError } from '../../lib/errors';
import { BusinessDate } from '../../lib/schemas';
import { CutoffBusyError, runCutoff } from '../../services/cutoff';
import { getSlot } from '../../services/store';
import { variantInfo } from '../../services/subscriptions';

export default async function dispatchRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<TypeBoxTypeProvider>();
  const { db } = app.deps.db;
  const DateSlot = Type.Object({ date: BusinessDate, slotId: Type.String() });

  app.get(
    '/dispatch',
    {
      config: { auth: 'staff', permission: 'dispatch.manage' },
      schema: { tags: ['Admin'], summary: 'Dispatch board for a date and slot', querystring: DateSlot },
    },
    async (req) => {
      const { date, slotId } = req.query;
      await getSlot(db, slotId);
      const [lastRun] = await db
        .select()
        .from(s.cutoffRuns)
        .where(and(eq(s.cutoffRuns.deliveryDate, date), eq(s.cutoffRuns.slotId, slotId)))
        .orderBy(desc(s.cutoffRuns.startedAt))
        .limit(1);
      const runs = await db.execute<{ id: string; route_id: string; route_name: string; agent_id: string | null; agent_name: string | null; status: string; by_status: Record<string, number>; stop_count: number }>(sql`
        select r.id, r.route_id, rt.name as route_name, r.agent_id, a.name as agent_name, r.status,
               coalesce(jsonb_object_agg(d.status, d.n) filter (where d.status is not null), '{}'::jsonb) as by_status,
               coalesce(sum(d.n), 0)::int as stop_count
        from runs r
        join routes rt on rt.id = r.route_id
        left join agents a on a.id = r.agent_id
        left join (select run_id, status, count(*)::int as n from deliveries where delivery_date = ${date} and slot_id = ${slotId} group by run_id, status) d on d.run_id = r.id
        where r.delivery_date = ${date} and r.slot_id = ${slotId}
        group by r.id, rt.name, a.name
        order by rt.name`);
      return {
        date,
        slotId,
        cutoff: lastRun
          ? { status: lastRun.status, startedAt: lastRun.startedAt.toISOString(), finishedAt: lastRun.finishedAt?.toISOString() ?? null, stats: lastRun.stats, error: lastRun.error }
          : { status: 'pending' },
        runs: runs.map((r) => ({
          id: r.id,
          route: { id: r.route_id, name: r.route_name },
          agent: r.agent_id ? { id: r.agent_id, name: r.agent_name } : null,
          status: r.status,
          stopCount: r.stop_count,
          byStatus: r.by_status,
        })),
      };
    },
  );

  app.post(
    '/dispatch/cutoff-runs',
    {
      config: { auth: 'staff', permission: 'dispatch.manage', idempotent: true },
      schema: {
        tags: ['Admin'],
        summary: 'Run or re-run the cutoff job for a date and slot (never double-charges)',
        body: DateSlot,
      },
    },
    async (req) => {
      try {
        const stats = await runCutoff(db, { date: req.body.date, slotId: req.body.slotId });
        await db.insert(s.auditLog).values({
          id: newId('aud'),
          actorType: 'staff',
          actorId: req.auth!.sub,
          action: 'cutoff.run',
          entityType: 'slot',
          entityId: req.body.slotId,
          after: { date: req.body.date, stats },
          requestId: req.id,
        });
        return { status: 'completed', stats };
      } catch (err) {
        if (err instanceof CutoffBusyError) throw new AppError('CONFLICT', 409, err.message);
        throw err;
      }
    },
  );

  app.get(
    '/production-plan',
    {
      config: { auth: 'staff', permission: 'inventory.write' },
      schema: { tags: ['Admin'], summary: 'Units to produce for a date and slot', querystring: DateSlot },
    },
    async (req) => {
      const [plan] = await db
        .select()
        .from(s.productionPlans)
        .where(and(eq(s.productionPlans.deliveryDate, req.query.date), eq(s.productionPlans.slotId, req.query.slotId)));
      if (!plan) return { date: req.query.date, generatedAt: null, lines: [] };
      const info = await variantInfo(db, plan.lines.map((l) => l.variantId));
      return {
        date: plan.deliveryDate,
        generatedAt: plan.generatedAt.toISOString(),
        lines: plan.lines.map((l) => ({ ...l, name: info.get(l.variantId)?.name ?? l.variantId })),
      };
    },
  );
}
