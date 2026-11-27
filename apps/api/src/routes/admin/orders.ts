import { directionsUrl } from '@dairy/core';
import { schema as s } from '@dairy/db';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import { and, desc, eq, ilike, lt, or, sql, type SQL } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { audit } from '../../lib/audit';
import { AppError } from '../../lib/errors';
import { CursorQuery, IdParam, decodeCursor, encodeCursor, money } from '../../lib/schemas';
import { requireAuth } from '../../plugins/auth';
import { cancelOrder, orderSummaries, orderView, shipOrder, transition } from '../../services/orders';

const STATUS = Type.Union(['pending_payment', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled', 'refunded'].map((x) => Type.Literal(x)));

export default async function adminOrderRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<TypeBoxTypeProvider>();
  const { db } = app.deps.db;
  const actor = (req: { auth: { sub: string } | null }) => ({ type: 'staff' as const, id: req.auth!.sub });

  app.get(
    '/orders',
    {
      config: { auth: 'staff', permission: 'orders.read' },
      schema: {
        tags: ['Admin'],
        summary: 'Orders with filters',
        querystring: Type.Intersect([CursorQuery, Type.Object({ status: Type.Optional(STATUS), q: Type.Optional(Type.String({ maxLength: 80 })) })]),
      },
    },
    async (req) => {
      const limit = req.query.limit ?? 30;
      const before = decodeCursor<{ id: string }>(req.query.cursor)?.id;
      const where: SQL[] = [];
      if (req.query.status) where.push(eq(s.orders.status, req.query.status));
      if (before) where.push(lt(s.orders.id, before));
      if (req.query.q) {
        const q = `%${req.query.q.trim()}%`;
        where.push(
          or(ilike(s.orders.number, q), sql`${s.orders.shippingAddress}->>'name' ilike ${q}`, sql`${s.orders.shippingAddress}->>'phone' ilike ${q}`, sql`${s.orders.shippingAddress}->>'pincode' ilike ${q}`, ilike(s.orders.trackingNumber, q))!,
        );
      }
      const rows = await db.select().from(s.orders).where(and(...where)).orderBy(desc(s.orders.id)).limit(limit + 1);
      const page = rows.slice(0, limit);
      const summaries = await orderSummaries(db, page.map((o) => o.id));
      const counts = await db.select({ status: s.orders.status, n: sql<number>`count(*)::int` }).from(s.orders).groupBy(s.orders.status);
      return {
        data: page.map((o) => ({
          id: o.id,
          number: o.number,
          status: o.status,
          placedAt: o.createdAt.toISOString(),
          customer: o.shippingAddress.name,
          phone: o.shippingAddress.phone,
          city: o.shippingAddress.city,
          pincode: o.shippingAddress.pincode,
          zone: o.shippingZone,
          items: summaries.get(o.id)?.count ?? 0,
          firstItem: summaries.get(o.id)?.firstName ?? '',
          total: money(o.totalPaise),
          courier: o.courier,
          trackingNumber: o.trackingNumber,
        })),
        counts: Object.fromEntries(counts.map((c) => [c.status, Number(c.n)])),
        page: { nextCursor: rows.length > limit ? encodeCursor({ id: page.at(-1)!.id }) : null, hasMore: rows.length > limit },
      };
    },
  );

  app.get(
    '/orders/export.csv',
    {
      config: { auth: 'staff', permission: 'orders.read' },
      schema: {
        tags: ['Admin'],
        summary: 'Download orders as CSV (opens in Excel / Google Sheets)',
        querystring: Type.Object({ status: Type.Optional(STATUS), from: Type.Optional(Type.String({ format: 'date' })), to: Type.Optional(Type.String({ format: 'date' })) }),
      },
    },
    async (req, reply) => {
      const where: SQL[] = [];
      if (req.query.status) where.push(eq(s.orders.status, req.query.status));
      if (req.query.from) where.push(sql`(${s.orders.createdAt} at time zone 'Asia/Kolkata')::date >= ${req.query.from}::date`);
      if (req.query.to) where.push(sql`(${s.orders.createdAt} at time zone 'Asia/Kolkata')::date <= ${req.query.to}::date`);
      const rows = await db.select().from(s.orders).where(and(...where)).orderBy(desc(s.orders.id)).limit(20_000);
      const summaries = await orderSummaries(db, rows.map((o) => o.id));
      const cell = (v: unknown) => {
        let t = v == null ? '' : String(v);
        if (/^[=+\-@\t\r]/.test(t)) t = `'${t}`; // stop spreadsheet formula injection
        return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
      };
      const rupees = (p: number) => (p / 100).toFixed(2);
      const header = ['Order', 'Placed (IST)', 'Status', 'Customer', 'Phone', 'City', 'State', 'Pincode', 'Items', 'Subtotal', 'Shipping', 'Discount', 'Total', 'Courier', 'Tracking', 'Map'];
      const lines = rows.map((o) =>
        [
          o.number,
          o.createdAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false }),
          o.status,
          o.shippingAddress.name,
          o.shippingAddress.phone,
          o.shippingAddress.city,
          o.shippingAddress.state,
          o.shippingAddress.pincode,
          summaries.get(o.id)?.count ?? 0,
          rupees(o.subtotalPaise),
          rupees(o.shippingPaise),
          rupees(o.discountPaise),
          rupees(o.totalPaise),
          o.courier,
          o.trackingNumber,
          o.shippingAddress.location ? directionsUrl(o.shippingAddress.location.lat, o.shippingAddress.location.lng) : '',
        ]
          .map(cell)
          .join(','),
      );
      reply.header('content-type', 'text/csv; charset=utf-8').header('content-disposition', `attachment; filename="orders-${new Date().toISOString().slice(0, 10)}.csv"`);
      return '\uFEFF' + [header.join(','), ...lines].join('\r\n') + '\r\n';
    },
  );

  app.post(
    '/orders/bulk/pack',
    {
      config: { auth: 'staff', permission: 'orders.fulfil' },
      schema: {
        tags: ['Admin'],
        summary: 'Mark several confirmed orders packed; returns which succeeded',
        body: Type.Object({ orderIds: Type.Array(Type.String(), { minItems: 1, maxItems: 100 }) }, { additionalProperties: false }),
      },
    },
    async (req) => {
      const done: string[] = [];
      const failed: { id: string; reason: string }[] = [];
      for (const id of new Set(req.body.orderIds)) {
        try {
          await db.transaction((tx) => transition(tx, id, 'pack', actor(req)));
          await audit(db, req, 'order.pack', 'order', id, null, { bulk: true });
          done.push(id);
        } catch (e) {
          failed.push({ id, reason: e instanceof Error ? e.message : 'failed' });
        }
      }
      return { packed: done, failed };
    },
  );

  app.post(
    '/orders/packing-slips',
    {
      config: { auth: 'staff', permission: 'orders.read' },
      schema: {
        tags: ['Admin'],
        summary: 'Full detail for several orders, for printing packing slips',
        body: Type.Object({ orderIds: Type.Array(Type.String(), { minItems: 1, maxItems: 100 }) }, { additionalProperties: false }),
      },
    },
    async (req) => ({ data: await Promise.all([...new Set(req.body.orderIds)].map((id) => orderView(db, id))) }),
  );

  app.get(
    '/orders/:orderId',
    { config: { auth: 'staff', permission: 'orders.read' }, schema: { tags: ['Admin'], summary: 'Order detail', params: IdParam('orderId') } },
    async (req) => {
      const view = await orderView(db, req.params.orderId);
      const [customer] = await db.select().from(s.customers).where(eq(s.customers.id, view.customerId));
      return { ...view, customer: customer ? { id: customer.id, name: customer.name, email: customer.email, phone: customer.phone } : null };
    },
  );

  app.post(
    '/orders/:orderId/pack',
    { config: { auth: 'staff', permission: 'orders.fulfil' }, schema: { tags: ['Admin'], summary: 'Mark packed', params: IdParam('orderId') } },
    async (req) => {
      await db.transaction((tx) => transition(tx, req.params.orderId, 'pack', actor(req)));
      await audit(db, req, 'order.pack', 'order', req.params.orderId, null, null);
      return orderView(db, req.params.orderId);
    },
  );

  app.post(
    '/orders/:orderId/ship',
    {
      config: { auth: 'staff', permission: 'orders.fulfil' },
      schema: {
        tags: ['Admin'],
        summary: 'Hand over to the courier (stock leaves the warehouse)',
        params: IdParam('orderId'),
        body: Type.Object(
          { courier: Type.String({ minLength: 2, maxLength: 40 }), trackingNumber: Type.String({ minLength: 4, maxLength: 60 }), trackingUrl: Type.Optional(Type.String({ format: 'uri', maxLength: 300 })) },
          { additionalProperties: false },
        ),
      },
    },
    async (req) => {
      await shipOrder(app.deps, req.params.orderId, req.body, actor(req));
      await audit(db, req, 'order.ship', 'order', req.params.orderId, null, req.body);
      return orderView(db, req.params.orderId);
    },
  );

  app.post(
    '/orders/:orderId/deliver',
    { config: { auth: 'staff', permission: 'orders.fulfil' }, schema: { tags: ['Admin'], summary: 'Mark delivered', params: IdParam('orderId') } },
    async (req) => {
      await db.transaction((tx) => transition(tx, req.params.orderId, 'deliver', actor(req)));
      await audit(db, req, 'order.deliver', 'order', req.params.orderId, null, null);
      return orderView(db, req.params.orderId);
    },
  );

  app.post(
    '/orders/:orderId/cancel',
    {
      config: { auth: 'staff', permission: 'orders.refund' },
      schema: {
        tags: ['Admin'],
        summary: 'Cancel before shipping; releases stock and refunds the payment',
        params: IdParam('orderId'),
        body: Type.Object({ reason: Type.String({ minLength: 3, maxLength: 200 }) }, { additionalProperties: false }),
      },
    },
    async (req) => {
      const before = await orderView(db, req.params.orderId);
      if (before.status === 'shipped' || before.status === 'delivered') throw new AppError('CONFLICT', 409, 'Shipped orders are handled as returns');
      await cancelOrder(app.deps, req.params.orderId, req.body.reason, actor(req));
      await audit(db, req, 'order.cancel', 'order', req.params.orderId, { status: before.status }, { reason: req.body.reason });
      requireAuth(req);
      return orderView(db, req.params.orderId);
    },
  );
}
