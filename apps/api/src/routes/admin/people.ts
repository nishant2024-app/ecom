import { newId } from '@dairy/core';
import { schema as s, STAFF_ROLES } from '@dairy/db';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import { and, asc, desc, eq, ilike, inArray, isNull, or, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { audit } from '../../lib/audit';
import { AppError, notFound } from '../../lib/errors';
import { IdParam, money } from '../../lib/schemas';
import { revokedKey } from '../../plugins/auth';
import { resetStoreCache } from '../../services/store';
import { ACCESS_TTL_SECONDS } from '../../services/tokens';

const PAID = ['confirmed', 'packed', 'shipped', 'delivered'];

/** Customers, staff and shipping settings. */
export default async function adminPeopleRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<TypeBoxTypeProvider>();
  const { db } = app.deps.db;

  app.get(
    '/customers',
    { config: { auth: 'staff', permission: 'customers.read' }, schema: { tags: ['Admin'], summary: 'Customers', querystring: Type.Object({ q: Type.Optional(Type.String({ maxLength: 80 })) }) } },
    async (req) => {
      const q = req.query.q?.trim();
      const rows = await db
        .select({
          c: s.customers,
          orders: sql<number>`count(${s.orders.id}) filter (where ${inArray(s.orders.status, PAID)})::int`,
          spent: sql<number>`coalesce(sum(${s.orders.totalPaise}) filter (where ${inArray(s.orders.status, PAID)}), 0)::bigint`,
          lastOrder: sql<string | null>`max(${s.orders.createdAt})::text`,
        })
        .from(s.customers)
        .leftJoin(s.orders, eq(s.orders.customerId, s.customers.id))
        .where(q ? or(ilike(s.customers.name, `%${q}%`), ilike(s.customers.email, `%${q}%`), ilike(s.customers.phone, `%${q}%`)) : undefined)
        .groupBy(s.customers.id)
        .orderBy(desc(s.customers.createdAt))
        .limit(100);
      return {
        data: rows.map((r) => ({
          id: r.c.id,
          name: r.c.name,
          email: r.c.email,
          phone: r.c.phone,
          status: r.c.status,
          orders: Number(r.orders),
          spent: money(Number(r.spent)),
          lastOrderAt: r.lastOrder,
          joinedAt: r.c.createdAt.toISOString(),
        })),
      };
    },
  );

  app.get(
    '/customers/:customerId',
    { config: { auth: 'staff', permission: 'customers.read' }, schema: { tags: ['Admin'], summary: 'Customer with addresses and orders', params: IdParam('customerId') } },
    async (req) => {
      const [c] = await db.select().from(s.customers).where(eq(s.customers.id, req.params.customerId));
      if (!c) throw notFound('Customer');
      const [addresses, orders] = await Promise.all([
        db
          .select()
          .from(s.addresses)
          .where(and(eq(s.addresses.customerId, c.id), isNull(s.addresses.archivedAt))),
        db.select().from(s.orders).where(eq(s.orders.customerId, c.id)).orderBy(desc(s.orders.createdAt)).limit(50),
      ]);
      return {
        id: c.id,
        name: c.name,
        email: c.email,
        phone: c.phone,
        status: c.status,
        joinedAt: c.createdAt.toISOString(),
        addresses,
        orders: orders.map((o) => ({ id: o.id, number: o.number, status: o.status, total: money(o.totalPaise), placedAt: o.createdAt.toISOString() })),
      };
    },
  );

  // ── Shipping zones ──
  app.get('/shipping-zones', { config: { auth: 'staff', permission: 'catalog.read' }, schema: { tags: ['Admin'], summary: 'Shipping zones' } }, async () => ({
    data: await db.select().from(s.shippingZones).orderBy(asc(s.shippingZones.sort)),
  }));

  app.put(
    '/shipping-zones/:code',
    {
      config: { auth: 'staff', permission: 'settings.write' },
      schema: {
        tags: ['Admin'],
        summary: 'Update a shipping zone',
        params: Type.Object({ code: Type.String() }),
        body: Type.Object(
          {
            name: Type.String({ minLength: 2, maxLength: 60 }),
            pincodePrefixes: Type.Array(Type.String({ pattern: '^[0-9]{1,6}$' }), { minItems: 1, maxItems: 200 }),
            feePaise: Type.Integer({ minimum: 0 }),
            freeAbovePaise: Type.Union([Type.Integer({ minimum: 0 }), Type.Null()]),
            includedGrams: Type.Integer({ minimum: 0 }),
            perExtraKgPaise: Type.Integer({ minimum: 0 }),
            etaMinDays: Type.Integer({ minimum: 0, maximum: 30 }),
            etaMaxDays: Type.Integer({ minimum: 0, maximum: 30 }),
            serviceable: Type.Boolean(),
          },
          { additionalProperties: false },
        ),
      },
    },
    async (req) => {
      const [before] = await db.select().from(s.shippingZones).where(eq(s.shippingZones.code, req.params.code));
      if (!before) throw notFound('Shipping zone');
      if (req.body.etaMaxDays < req.body.etaMinDays) throw new AppError('VALIDATION_FAILED', 400, 'Latest delivery day must be on or after the earliest');
      await db.update(s.shippingZones).set(req.body).where(eq(s.shippingZones.code, req.params.code));
      resetStoreCache();
      await audit(db, req, 'shipping_zone.update', 'shipping_zone', req.params.code, before, req.body);
      const [after] = await db.select().from(s.shippingZones).where(eq(s.shippingZones.code, req.params.code));
      return after;
    },
  );

  // ── Staff ──
  app.get('/staff', { config: { auth: 'staff', permission: 'staff.manage' }, schema: { tags: ['Admin'], summary: 'Team members' } }, async () => ({
    data: (await db.select().from(s.staff).orderBy(asc(s.staff.createdAt))).map((m) => ({
      id: m.id,
      name: m.name,
      email: m.email,
      role: m.role,
      status: m.status,
      linked: !!m.googleSub,
      lastSignInAt: m.lastSignInAt?.toISOString() ?? null,
    })),
  }));

  const Role = Type.Union(STAFF_ROLES.map((r) => Type.Literal(r)));
  app.post(
    '/staff',
    {
      config: { auth: 'staff', permission: 'staff.manage' },
      schema: {
        tags: ['Admin'],
        summary: 'Invite by Google email',
        body: Type.Object({ email: Type.String({ format: 'email' }), name: Type.String({ minLength: 2, maxLength: 80 }), role: Role }, { additionalProperties: false }),
      },
    },
    async (req, reply) => {
      const email = req.body.email.toLowerCase();
      const [clash] = await db
        .select({ id: s.staff.id })
        .from(s.staff)
        .where(sql`lower(${s.staff.email}) = ${email}`);
      if (clash) throw new AppError('CONFLICT', 409, 'This email is already on the team');
      const id = newId('stf');
      await db.insert(s.staff).values({ id, email, name: req.body.name, role: req.body.role, invitedBy: req.auth!.sub });
      await audit(db, req, 'staff.invite', 'staff', id, null, { email, role: req.body.role });
      return reply.status(201).send({ id, email, name: req.body.name, role: req.body.role, status: 'active', linked: false, lastSignInAt: null });
    },
  );

  app.patch(
    '/staff/:staffId',
    {
      config: { auth: 'staff', permission: 'staff.manage' },
      schema: {
        tags: ['Admin'],
        summary: 'Change role or deactivate (revokes sessions)',
        params: IdParam('staffId'),
        body: Type.Object({ role: Type.Optional(Role), status: Type.Optional(Type.Union([Type.Literal('active'), Type.Literal('deactivated')])) }, { additionalProperties: false, minProperties: 1 }),
      },
    },
    async (req) => {
      if (req.params.staffId === req.auth!.sub) throw new AppError('CONFLICT', 409, 'You cannot change your own role or access');
      const [before] = await db.select().from(s.staff).where(eq(s.staff.id, req.params.staffId));
      if (!before) throw notFound('Staff member');
      await db.update(s.staff).set(req.body).where(eq(s.staff.id, before.id));
      if (req.body.status === 'deactivated' || (req.body.role && req.body.role !== before.role)) {
        const revoked = await db
          .update(s.sessions)
          .set({ revokedAt: app.deps.now() })
          .where(and(eq(s.sessions.userType, 'staff'), eq(s.sessions.userId, before.id), isNull(s.sessions.revokedAt)))
          .returning({ id: s.sessions.id });
        for (const r of revoked) await app.deps.kv.set(revokedKey(r.id), '1', ACCESS_TTL_SECONDS);
      }
      await audit(db, req, 'staff.update', 'staff', before.id, { role: before.role, status: before.status }, req.body);
      const [after] = await db.select().from(s.staff).where(eq(s.staff.id, before.id));
      return { id: after!.id, name: after!.name, email: after!.email, role: after!.role, status: after!.status, linked: !!after!.googleSub, lastSignInAt: after!.lastSignInAt?.toISOString() ?? null };
    },
  );

  app.get(
    '/audit-log',
    { config: { auth: 'staff', permission: 'audit.read' }, schema: { tags: ['Admin'], summary: 'Recent staff actions', querystring: Type.Object({ entityId: Type.Optional(Type.String()) }) } },
    async (req) => ({
      data: await db
        .select()
        .from(s.auditLog)
        .where(req.query.entityId ? eq(s.auditLog.entityId, req.query.entityId) : undefined)
        .orderBy(desc(s.auditLog.at))
        .limit(100),
    }),
  );
}
