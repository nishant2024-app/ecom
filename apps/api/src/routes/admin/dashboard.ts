import { addDays, todayIST } from '@dairy/core';
import { schema as s } from '@dairy/db';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import { and, desc, gte, inArray, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { money } from '../../lib/schemas';
import { orderSummaries } from '../../services/orders';
import { MIN_SHELF_DAYS } from '../../services/stock';

const PAID = ['confirmed', 'packed', 'shipped', 'delivered'];

export default async function dashboardRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<TypeBoxTypeProvider>();
  const { db } = app.deps.db;

  app.get(
    '/dashboard',
    {
      config: { auth: 'staff', permission: 'dashboard.read' },
      schema: { tags: ['Admin'], summary: 'Sales, fulfilment queue, low stock and recent orders', querystring: Type.Object({ days: Type.Optional(Type.Integer({ minimum: 1, maximum: 90, default: 7 })) }) },
    },
    async (req) => {
      const days = req.query.days ?? 7;
      const today = todayIST(app.deps.now());
      const from = addDays(today, -(days - 1));
      const prevFrom = addDays(from, -days);

      const daily = await db
        .select({ date: s.orders.placedOn, revenue: sql<number>`sum(${s.orders.totalPaise})::bigint`, orders: sql<number>`count(*)::int` })
        .from(s.orders)
        .where(and(inArray(s.orders.status, PAID), gte(s.orders.placedOn, prevFrom)))
        .groupBy(s.orders.placedOn);
      const series: { date: string; revenue: { amount: number; currency: 'INR' }; orders: number }[] = [];
      let revenue = 0;
      let orders = 0;
      let prevRevenue = 0;
      for (let i = 0; i < days; i++) {
        const d = addDays(from, i);
        const row = daily.find((r) => r.date === d);
        series.push({ date: d, revenue: money(Number(row?.revenue ?? 0)), orders: Number(row?.orders ?? 0) });
        revenue += Number(row?.revenue ?? 0);
        orders += Number(row?.orders ?? 0);
      }
      for (const r of daily) if (r.date < from) prevRevenue += Number(r.revenue);

      const byStatus = await db.select({ status: s.orders.status, n: sql<number>`count(*)::int` }).from(s.orders).groupBy(s.orders.status);
      const top = await db.execute<{ name: string; pack_size: string; units: number; revenue: number }>(sql`
        select oi.name_snapshot as name, oi.pack_size, sum(oi.quantity)::int as units, sum(oi.line_total_paise)::bigint as revenue
        from order_items oi join orders o on o.id = oi.order_id
        where o.status in ('confirmed','packed','shipped','delivered') and o.placed_on >= ${from}
        group by 1, 2 order by revenue desc limit 5`);
      const low = await db.execute<{ variant_id: string; name: string; pack_size: string; available: number; threshold: number }>(sql`
        select v.id as variant_id, p.name_en as name, v.pack_size, coalesce(sum(b.on_hand - b.reserved) filter (where b.status = 'active' and b.expires_on >= ${addDays(today, MIN_SHELF_DAYS)}), 0)::int as available, v.low_stock_threshold as threshold
        from product_variants v join products p on p.id = v.product_id left join batches b on b.variant_id = v.id
        where v.status = 'active' and p.status = 'active'
        group by v.id, p.name_en, v.pack_size, v.low_stock_threshold
        having coalesce(sum(b.on_hand - b.reserved) filter (where b.status = 'active' and b.expires_on >= ${addDays(today, MIN_SHELF_DAYS)}), 0) <= v.low_stock_threshold
        order by available asc limit 10`);
      const expiring = await db.execute<{ code: string; name: string; expires_on: string; on_hand: number }>(sql`
        select b.code, p.name_en || ' ' || v.pack_size as name, b.expires_on::text, (b.on_hand - b.reserved)::int as on_hand
        from batches b join product_variants v on v.id = b.variant_id join products p on p.id = v.product_id
        where b.status = 'active' and b.on_hand > b.reserved and b.expires_on < ${addDays(today, 30)}
        order by b.expires_on limit 10`);
      const recent = await db.select().from(s.orders).orderBy(desc(s.orders.createdAt)).limit(8);
      const summaries = await orderSummaries(db, recent.map((o) => o.id));

      return {
        range: { from, to: today, days },
        revenue: money(revenue),
        revenueChangePercent: prevRevenue > 0 ? Math.round(((revenue - prevRevenue) / prevRevenue) * 100) : null,
        orders,
        averageOrderValue: money(orders ? Math.round(revenue / orders) : 0),
        series,
        byStatus: Object.fromEntries(byStatus.map((r) => [r.status, Number(r.n)])),
        toPack: Number(byStatus.find((r) => r.status === 'confirmed')?.n ?? 0),
        toShip: Number(byStatus.find((r) => r.status === 'packed')?.n ?? 0),
        topProducts: top.map((t) => ({ name: t.name, packSize: t.pack_size, units: Number(t.units), revenue: money(Number(t.revenue)) })),
        lowStock: low.map((l) => ({ variantId: l.variant_id, name: l.name, packSize: l.pack_size, available: Number(l.available), threshold: Number(l.threshold) })),
        expiringSoon: expiring.map((e) => ({ batch: e.code, name: e.name, expiresOn: e.expires_on, units: Number(e.on_hand) })),
        recentOrders: recent.map((o) => ({
          id: o.id,
          number: o.number,
          status: o.status,
          customer: o.shippingAddress.name,
          city: o.shippingAddress.city,
          total: money(o.totalPaise),
          items: summaries.get(o.id)?.count ?? 0,
          placedAt: o.createdAt.toISOString(),
        })),
      };
    },
  );
}
