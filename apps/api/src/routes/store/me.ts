import { newId, normalizeIndianMobile } from '@dairy/core';
import { schema as s } from '@dairy/db';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { AppError, notFound } from '../../lib/errors';
import { ErrorResponses, IdParam, Nullable, money } from '../../lib/schemas';
import { requireAuth, revokedKey } from '../../plugins/auth';
import { resolveZone } from '../../services/store';
import { ACCESS_TTL_SECONDS } from '../../services/tokens';

const GeoPoint = Type.Object({ lat: Type.Number({ minimum: -90, maximum: 90 }), lng: Type.Number({ minimum: -180, maximum: 180 }) });

const AddressInput = Type.Object(
  {
    label: Type.Optional(Type.String({ maxLength: 30 })),
    line1: Type.String({ minLength: 3, maxLength: 120 }),
    line2: Type.Optional(Type.String({ maxLength: 120 })),
    landmark: Type.Optional(Type.String({ maxLength: 120 })),
    society: Type.Optional(Type.String({ maxLength: 120 })),
    city: Type.String({ minLength: 2, maxLength: 60 }),
    state: Type.String({ minLength: 2, maxLength: 60 }),
    pincode: Type.String({ pattern: '^[1-9][0-9]{5}$' }),
    location: Type.Optional(GeoPoint),
    deliveryInstructions: Type.Optional(Type.String({ maxLength: 300 })),
    isDefault: Type.Optional(Type.Boolean()),
  },
  { additionalProperties: false },
);

const AddressOut = Type.Object({
  id: Type.String(),
  label: Nullable(Type.String()),
  line1: Type.String(),
  line2: Nullable(Type.String()),
  landmark: Nullable(Type.String()),
  society: Nullable(Type.String()),
  city: Type.String(),
  state: Type.String(),
  pincode: Type.String(),
  location: Nullable(GeoPoint),
  deliveryInstructions: Nullable(Type.String()),
  zoneId: Type.String(),
  isDefault: Type.Boolean(),
});

const CustomerOut = Type.Object({
  id: Type.String(),
  name: Type.String(),
  email: Type.String(),
  phone: Nullable(Type.String()),
  language: Type.String(),
  profileComplete: Type.Boolean(),
  defaultAddressId: Nullable(Type.String()),
  createdAt: Type.String(),
});

const Prefs = Type.Object(
  {
    marketingPush: Type.Optional(Type.Boolean()),
    marketingEmail: Type.Optional(Type.Boolean()),
    cutoffReminder: Type.Optional(Type.Boolean()),
    deliveredPush: Type.Optional(Type.Boolean()),
  },
  { additionalProperties: false },
);

export default async function meRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<TypeBoxTypeProvider>();
  const { db } = app.deps.db;
  const customerCfg = { auth: 'customer' as const };

  async function loadCustomer(id: string) {
    const [c] = await db.select().from(s.customers).where(eq(s.customers.id, id));
    if (!c) throw notFound('Customer');
    return c;
  }
  const customerOut = (c: typeof s.customers.$inferSelect) => ({
    id: c.id,
    name: c.name,
    email: c.email,
    phone: c.phone,
    language: c.language,
    profileComplete: !!c.phone && !!c.defaultAddressId,
    defaultAddressId: c.defaultAddressId,
    createdAt: c.createdAt.toISOString(),
  });

  async function listAddresses(customerId: string, defaultId: string | null) {
    const rows = await db
      .select({
        a: s.addresses,
        lat: sql<number | null>`ST_Y(${s.addresses.location}::geometry)`,
        lng: sql<number | null>`ST_X(${s.addresses.location}::geometry)`,
      })
      .from(s.addresses)
      .where(and(eq(s.addresses.customerId, customerId), isNull(s.addresses.archivedAt)))
      .orderBy(asc(s.addresses.createdAt));
    return rows.map(({ a, lat, lng }) => ({
      id: a.id,
      label: a.label,
      line1: a.line1,
      line2: a.line2,
      landmark: a.landmark,
      society: a.society,
      city: a.city,
      state: a.state,
      pincode: a.pincode,
      location: lat !== null && lng !== null ? { lat: Number(lat), lng: Number(lng) } : null,
      deliveryInstructions: a.deliveryInstructions,
      zoneId: a.zoneId ?? '',
      isDefault: a.id === defaultId,
    }));
  }

  app.get('/me', { config: customerCfg, schema: { tags: ['Profile'], summary: 'My profile', response: { 200: CustomerOut } } }, async (req) =>
    customerOut(await loadCustomer(requireAuth(req).sub)),
  );

  app.patch(
    '/me',
    {
      config: customerCfg,
      schema: {
        tags: ['Profile'],
        summary: 'Update profile',
        body: Type.Object(
          {
            name: Type.Optional(Type.String({ minLength: 1, maxLength: 80 })),
            phone: Type.Optional(Type.String({ maxLength: 20 })),
            language: Type.Optional(Type.Union([Type.Literal('en'), Type.Literal('hi')])),
          },
          { additionalProperties: false, minProperties: 1 },
        ),
        response: { 200: CustomerOut, ...ErrorResponses },
      },
    },
    async (req) => {
      const id = requireAuth(req).sub;
      const { name, phone, language } = req.body;
      let normalized: string | undefined;
      if (phone !== undefined) {
        const n = normalizeIndianMobile(phone);
        if (!n) throw new AppError('VALIDATION_FAILED', 400, 'Enter a valid 10-digit Indian mobile number', [{ field: '/phone', code: 'format', message: 'Invalid Indian mobile number' }]);
        normalized = n;
      }
      await db
        .update(s.customers)
        .set({ ...(name ? { name: name.trim() } : {}), ...(normalized ? { phone: normalized } : {}), ...(language ? { language } : {}) })
        .where(eq(s.customers.id, id));
      return customerOut(await loadCustomer(id));
    },
  );

  app.delete(
    '/me',
    {
      config: customerCfg,
      schema: {
        tags: ['Profile'],
        summary: 'Request account deletion',
        response: { 202: Type.Object({ status: Type.String(), erasesOn: Type.String(), walletRefund: Type.Any() }) },
      },
    },
    async (req, reply) => {
      const auth = requireAuth(req);
      const now = app.deps.now();
      const result = await db.transaction(async (tx) => {
        await tx.update(s.customers).set({ status: 'deletion_requested', deletionRequestedAt: now }).where(eq(s.customers.id, auth.sub));
        await tx
          .update(s.subscriptions)
          .set({ status: 'cancelled', cancelReason: 'account_deleted' })
          .where(and(eq(s.subscriptions.customerId, auth.sub), eq(s.subscriptions.status, 'active')));
        const sessions = await tx
          .update(s.sessions)
          .set({ revokedAt: now })
          .where(and(eq(s.sessions.userType, 'customer'), eq(s.sessions.userId, auth.sub), isNull(s.sessions.revokedAt)))
          .returning({ id: s.sessions.id });
        const [wallet] = await tx.select({ balance: s.wallets.balancePaise }).from(s.wallets).where(eq(s.wallets.customerId, auth.sub));
        return { sessions, balance: Math.max(0, wallet?.balance ?? 0) };
      });
      for (const ses of result.sessions) await app.deps.kv.set(revokedKey(ses.id), '1', ACCESS_TTL_SECONDS);
      const erasesOn = new Date(now.getTime() + 30 * 86_400_000).toISOString().slice(0, 10);
      return reply.status(202).send({ status: 'deletion_requested', erasesOn, walletRefund: money(result.balance) });
    },
  );

  app.get(
    '/me/addresses',
    { config: customerCfg, schema: { tags: ['Profile'], summary: 'List addresses', response: { 200: Type.Object({ data: Type.Array(AddressOut) }) } } },
    async (req) => {
      const c = await loadCustomer(requireAuth(req).sub);
      return { data: await listAddresses(c.id, c.defaultAddressId) };
    },
  );

  app.post(
    '/me/addresses',
    {
      config: customerCfg,
      schema: { tags: ['Profile'], summary: 'Add address', body: AddressInput, response: { 201: AddressOut, ...ErrorResponses } },
    },
    async (req, reply) => {
      const customerId = requireAuth(req).sub;
      const body = req.body;
      const zone = await resolveZone(db, { pincode: body.pincode, location: body.location ?? null });
      if (!zone.zoneId) {
        throw new AppError('NOT_SERVICEABLE', 422, zone.needsPin ? 'Drop a pin on the map so we can find your delivery area' : 'We do not deliver to this address yet');
      }
      const id = newId('adr');
      const c = await loadCustomer(customerId);
      await db.transaction(async (tx) => {
        await tx.insert(s.addresses).values({
          id,
          customerId,
          label: body.label ?? null,
          line1: body.line1,
          line2: body.line2 ?? null,
          landmark: body.landmark ?? null,
          society: body.society ?? null,
          city: body.city,
          state: body.state,
          pincode: body.pincode,
          location: body.location ?? null,
          zoneId: zone.zoneId,
          deliveryInstructions: body.deliveryInstructions ?? null,
        });
        if (body.isDefault || !c.defaultAddressId) await tx.update(s.customers).set({ defaultAddressId: id }).where(eq(s.customers.id, customerId));
      });
      const fresh = await loadCustomer(customerId);
      const out = (await listAddresses(customerId, fresh.defaultAddressId)).find((a) => a.id === id)!;
      return reply.status(201).send(out);
    },
  );

  app.patch(
    '/me/addresses/:addressId',
    {
      config: customerCfg,
      schema: { tags: ['Profile'], summary: 'Update address', params: IdParam('addressId'), body: AddressInput, response: { 200: AddressOut, ...ErrorResponses } },
    },
    async (req) => {
      const customerId = requireAuth(req).sub;
      const body = req.body;
      const [existing] = await db
        .select()
        .from(s.addresses)
        .where(and(eq(s.addresses.id, req.params.addressId), eq(s.addresses.customerId, customerId), isNull(s.addresses.archivedAt)));
      if (!existing) throw notFound('Address');
      const zone = await resolveZone(db, { pincode: body.pincode, location: body.location ?? null });
      if (!zone.zoneId) throw new AppError('NOT_SERVICEABLE', 422, 'We do not deliver to this address yet');
      await db
        .update(s.addresses)
        .set({
          label: body.label ?? null,
          line1: body.line1,
          line2: body.line2 ?? null,
          landmark: body.landmark ?? null,
          society: body.society ?? null,
          city: body.city,
          state: body.state,
          pincode: body.pincode,
          location: body.location ?? null,
          zoneId: zone.zoneId,
          deliveryInstructions: body.deliveryInstructions ?? null,
        })
        .where(eq(s.addresses.id, existing.id));
      if (body.isDefault) await db.update(s.customers).set({ defaultAddressId: existing.id }).where(eq(s.customers.id, customerId));
      const c = await loadCustomer(customerId);
      return (await listAddresses(customerId, c.defaultAddressId)).find((a) => a.id === existing.id)!;
    },
  );

  app.delete(
    '/me/addresses/:addressId',
    { config: customerCfg, schema: { tags: ['Profile'], summary: 'Remove address', params: IdParam('addressId') } },
    async (req, reply) => {
      const customerId = requireAuth(req).sub;
      const [inUse] = await db
        .select({ id: s.subscriptions.id })
        .from(s.subscriptions)
        .where(and(eq(s.subscriptions.addressId, req.params.addressId), eq(s.subscriptions.status, 'active')))
        .limit(1);
      if (inUse) throw new AppError('CONFLICT', 409, 'This address is used by an active subscription; change the subscription first');
      const archived = await db
        .update(s.addresses)
        .set({ archivedAt: app.deps.now() })
        .where(and(eq(s.addresses.id, req.params.addressId), eq(s.addresses.customerId, customerId), isNull(s.addresses.archivedAt)))
        .returning({ id: s.addresses.id });
      if (archived.length === 0) throw notFound('Address');
      await db
        .update(s.customers)
        .set({ defaultAddressId: null })
        .where(and(eq(s.customers.id, customerId), eq(s.customers.defaultAddressId, req.params.addressId)));
      return reply.status(204).send();
    },
  );

  app.post(
    '/me/devices',
    {
      config: customerCfg,
      schema: {
        tags: ['Profile'],
        summary: 'Register a push token',
        body: Type.Object({
          platform: Type.Union([Type.Literal('web'), Type.Literal('android')]),
          pushToken: Type.String({ minLength: 10, maxLength: 4096 }),
          appVersion: Type.Optional(Type.String({ maxLength: 40 })),
        }),
        response: { 201: Type.Object({ id: Type.String() }) },
      },
    },
    async (req, reply) => {
      const customerId = requireAuth(req).sub;
      const id = newId('dev');
      const [row] = await db
        .insert(s.devices)
        .values({ id, customerId, platform: req.body.platform, pushToken: req.body.pushToken, appVersion: req.body.appVersion ?? null })
        .onConflictDoUpdate({
          target: s.devices.pushToken,
          set: { customerId, appVersion: req.body.appVersion ?? null, lastSeenAt: app.deps.now() },
        })
        .returning({ id: s.devices.id });
      return reply.status(201).send({ id: row!.id });
    },
  );

  app.delete(
    '/me/devices/:deviceId',
    { config: customerCfg, schema: { tags: ['Profile'], summary: 'Remove a push token', params: IdParam('deviceId') } },
    async (req, reply) => {
      await db.delete(s.devices).where(and(eq(s.devices.id, req.params.deviceId), eq(s.devices.customerId, requireAuth(req).sub)));
      return reply.status(204).send();
    },
  );

  app.get(
    '/me/notification-preferences',
    { config: customerCfg, schema: { tags: ['Profile'], summary: 'Notification preferences', response: { 200: Prefs } } },
    async (req) => (await loadCustomer(requireAuth(req).sub)).notificationPrefs,
  );

  app.put(
    '/me/notification-preferences',
    { config: customerCfg, schema: { tags: ['Profile'], summary: 'Set notification preferences', body: Prefs, response: { 200: Prefs } } },
    async (req) => {
      const c = await loadCustomer(requireAuth(req).sub);
      const prefs = { ...c.notificationPrefs, ...req.body };
      await db.update(s.customers).set({ notificationPrefs: prefs }).where(eq(s.customers.id, c.id));
      return prefs;
    },
  );
}
