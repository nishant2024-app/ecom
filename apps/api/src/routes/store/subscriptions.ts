import {
  addDays,
  cutoffAt,
  itemsForDate,
  monthDates,
  newId,
  slotRunsOn,
  todayIST,
  validateItems,
  validatePause,
  SubscriptionError,
  type BusinessDate,
  type SubscriptionItemSpec,
} from '@dairy/core';
import { schema as s } from '@dairy/db';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import { and, desc, eq, gte, inArray, isNull, lte } from 'drizzle-orm';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { AppError, notFound } from '../../lib/errors';
import { BusinessDate as DateSchema, ErrorResponses, IdParam, Money, Month, Nullable, money } from '../../lib/schemas';
import { requireAuth } from '../../plugins/auth';
import { getSlot, holidaySet, slotFirstOpenDate, type SlotRow } from '../../services/store';
import {
  assertSubscribable,
  getOwnedSubscription,
  loadSubscriptions,
  subscriptionOut,
  variantInfo,
  type LoadedSubscription,
} from '../../services/subscriptions';
import { lang } from './catalog';

const Pattern = Type.Union([Type.Literal('daily'), Type.Literal('alternate'), Type.Literal('weekdays')]);
const ItemInput = Type.Object(
  {
    variantId: Type.String(),
    quantity: Type.Optional(Type.Integer({ minimum: 1, maximum: 20 })),
    weekdayQuantities: Type.Optional(Type.Array(Type.Integer({ minimum: 0, maximum: 20 }), { minItems: 7, maxItems: 7 })),
  },
  { additionalProperties: false },
);
const SubscriptionOut = Type.Object({
  id: Type.String(),
  status: Type.String(),
  pattern: Type.String(),
  startsOn: Type.String(),
  endsOn: Nullable(Type.String()),
  effectiveFrom: Type.String(),
  address: Type.Object({ id: Type.String(), label: Nullable(Type.String()) }),
  slot: Type.Object({ id: Type.String(), code: Type.String(), label: Type.String() }),
  items: Type.Array(
    Type.Object({
      variantId: Type.String(),
      name: Type.String(),
      quantity: Type.Optional(Type.Integer()),
      weekdayQuantities: Type.Optional(Type.Array(Type.Integer())),
      unitPrice: Money,
    }),
  ),
  estimatedMonthly: Money,
  pauses: Type.Array(Type.Object({ id: Type.String(), startsOn: Type.String(), endsOn: Type.String() })),
  nextDelivery: Nullable(Type.Object({ date: Type.String(), cutoffAt: Type.String() })),
});
const CalendarItem = Type.Object({ variantId: Type.String(), name: Type.String(), quantity: Type.Integer() });
const CalendarDay = Type.Object({
  date: Type.String(),
  state: Type.String(),
  deliveryId: Nullable(Type.String()),
  items: Type.Array(CalendarItem),
  charge: Nullable(Money),
  estimatedCharge: Nullable(Money),
  editable: Type.Boolean(),
  cutoffAt: Nullable(Type.String()),
});

function rethrow(err: unknown): never {
  if (err instanceof SubscriptionError) {
    throw new AppError(err.code, err.code === 'VALIDATION_FAILED' ? 400 : 422, err.message);
  }
  throw err;
}

export default async function subscriptionRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<TypeBoxTypeProvider>();
  const { db } = app.deps.db;
  const cfg = { auth: 'customer' as const };

  async function addressFor(customerId: string, addressId: string) {
    const [a] = await db
      .select()
      .from(s.addresses)
      .where(and(eq(s.addresses.id, addressId), eq(s.addresses.customerId, customerId), isNull(s.addresses.archivedAt)));
    if (!a) throw new AppError('VALIDATION_FAILED', 400, 'Unknown address');
    if (!a.zoneId) throw new AppError('NOT_SERVICEABLE', 422, 'We do not deliver to this address yet');
    return a;
  }

  async function render(req: FastifyRequest, sub: LoadedSubscription) {
    const language = lang(req);
    const slot = await getSlot(db, sub.row.slotId);
    const now = app.deps.now();
    const firstOpen = await slotFirstOpenDate(db, slot, now);
    const holidays = await holidaySet(db, slot.sellerId, slot.id, firstOpen, addDays(firstOpen, 60));
    const info = await variantInfo(db, sub.items.map((i) => i.variantId));
    const [address] = await db.select({ label: s.addresses.label }).from(s.addresses).where(eq(s.addresses.id, sub.row.addressId));
    return subscriptionOut(sub, info, {
      language,
      firstOpen,
      holidays,
      slot: { id: slot.id, code: slot.code, label: language === 'hi' ? slot.labelHi : slot.labelEn },
      addressLabel: address?.label ?? null,
      cutoffAt: (d) => cutoffAt(d, slot.timing),
    });
  }

  function itemRows(subscriptionId: string, pattern: string, items: SubscriptionItemSpec[]) {
    return items.map((i) => ({
      id: newId('sbi'),
      subscriptionId,
      variantId: i.variantId,
      quantity: pattern === 'weekdays' ? null : (i.quantity ?? null),
      weekdayQuantities: pattern === 'weekdays' ? [...(i.weekdayQuantities ?? [])] : null,
    }));
  }

  async function assertOpenDate(slot: SlotRow, date: BusinessDate) {
    const firstOpen = await slotFirstOpenDate(db, slot, app.deps.now());
    if (date < firstOpen) throw new AppError('CUTOFF_PASSED', 422, `Changes are open from ${firstOpen}`);
    return firstOpen;
  }

  app.get(
    '/subscriptions',
    {
      config: cfg,
      schema: {
        tags: ['Subscriptions'],
        summary: 'My subscriptions',
        querystring: Type.Object({ status: Type.Optional(Type.Union([Type.Literal('active'), Type.Literal('cancelled')])) }),
        response: { 200: Type.Object({ data: Type.Array(SubscriptionOut) }) },
      },
    },
    async (req) => {
      const customerId = requireAuth(req).sub;
      const rows = await db
        .select()
        .from(s.subscriptions)
        .where(and(eq(s.subscriptions.customerId, customerId), ...(req.query.status ? [eq(s.subscriptions.status, req.query.status)] : [])))
        .orderBy(desc(s.subscriptions.createdAt));
      const loaded = await loadSubscriptions(db, rows);
      return { data: await Promise.all(loaded.map((l) => render(req, l))) };
    },
  );

  app.post(
    '/subscriptions',
    {
      config: { ...cfg, idempotent: true },
      schema: {
        tags: ['Subscriptions'],
        summary: 'Create a subscription',
        body: Type.Object(
          {
            addressId: Type.String(),
            slotId: Type.String(),
            pattern: Pattern,
            startsOn: DateSchema,
            endsOn: Type.Optional(Nullable(DateSchema)),
            items: Type.Array(ItemInput, { minItems: 1, maxItems: 10 }),
          },
          { additionalProperties: false },
        ),
        response: { 201: SubscriptionOut, ...ErrorResponses },
      },
    },
    async (req, reply) => {
      const customerId = requireAuth(req).sub;
      const body = req.body;
      try {
        validateItems(body.pattern, body.items);
      } catch (e) {
        rethrow(e);
      }
      const [customer] = await db.select().from(s.customers).where(eq(s.customers.id, customerId));
      if (!customer?.phone) throw new AppError('PROFILE_INCOMPLETE', 422, 'Add your mobile number so our delivery partner can reach you');
      const address = await addressFor(customerId, body.addressId);
      const slot = await getSlot(db, body.slotId);
      await assertOpenDate(slot, body.startsOn);
      if (!slotRunsOn(body.startsOn, slot.timing)) throw new AppError('INVALID_DELIVERY_DATE', 422, 'No deliveries in this slot on the start date');
      if (body.endsOn && body.endsOn < body.startsOn) throw new AppError('VALIDATION_FAILED', 400, 'endsOn must be on or after startsOn');
      await assertSubscribable(db, body.items.map((i) => i.variantId), address.zoneId);

      const id = newId('sub');
      await db.transaction(async (tx) => {
        await tx.insert(s.subscriptions).values({
          id,
          customerId,
          sellerId: slot.sellerId,
          addressId: address.id,
          slotId: slot.id,
          pattern: body.pattern,
          anchorDate: body.startsOn,
          startsOn: body.startsOn,
          endsOn: body.endsOn ?? null,
        });
        await tx.insert(s.subscriptionItems).values(itemRows(id, body.pattern, body.items));
      });
      return reply.status(201).send(await render(req, await getOwnedSubscription(db, customerId, id)));
    },
  );

  app.get(
    '/subscriptions/:subscriptionId',
    { config: cfg, schema: { tags: ['Subscriptions'], summary: 'Subscription detail', params: IdParam('subscriptionId'), response: { 200: SubscriptionOut, ...ErrorResponses } } },
    async (req) => render(req, await getOwnedSubscription(db, requireAuth(req).sub, req.params.subscriptionId)),
  );

  app.patch(
    '/subscriptions/:subscriptionId',
    {
      config: cfg,
      schema: {
        tags: ['Subscriptions'],
        summary: 'Change pattern, items, address or slot from the next open date',
        params: IdParam('subscriptionId'),
        body: Type.Object(
          {
            pattern: Type.Optional(Pattern),
            items: Type.Optional(Type.Array(ItemInput, { minItems: 1, maxItems: 10 })),
            addressId: Type.Optional(Type.String()),
            slotId: Type.Optional(Type.String()),
            endsOn: Type.Optional(Nullable(DateSchema)),
          },
          { additionalProperties: false, minProperties: 1 },
        ),
        response: { 200: SubscriptionOut, ...ErrorResponses },
      },
    },
    async (req) => {
      const customerId = requireAuth(req).sub;
      const sub = await getOwnedSubscription(db, customerId, req.params.subscriptionId);
      if (sub.row.status !== 'active') throw new AppError('CONFLICT', 409, 'This subscription is cancelled');
      const body = req.body;
      const pattern = body.pattern ?? sub.row.pattern;
      if (body.pattern && body.pattern !== sub.row.pattern && !body.items) {
        throw new AppError('VALIDATION_FAILED', 400, 'Send items together with a new pattern');
      }
      const slot = await getSlot(db, body.slotId ?? sub.row.slotId);
      const firstOpen = await slotFirstOpenDate(db, slot, app.deps.now());
      const address = await addressFor(customerId, body.addressId ?? sub.row.addressId);
      if (body.items) {
        try {
          validateItems(pattern as 'daily', body.items);
        } catch (e) {
          rethrow(e);
        }
        await assertSubscribable(db, body.items.map((i) => i.variantId), address.zoneId);
      }
      if (body.endsOn && body.endsOn < firstOpen) throw new AppError('CUTOFF_PASSED', 422, `The earliest end date is ${firstOpen}`);

      // Dates before firstOpen are locked (already materialised as deliveries by the cutoff job),
      // so editing the spec in place only affects firstOpen onward.
      await db.transaction(async (tx) => {
        await tx
          .update(s.subscriptions)
          .set({
            pattern,
            addressId: address.id,
            slotId: slot.id,
            ...(body.pattern && body.pattern !== sub.row.pattern ? { anchorDate: firstOpen } : {}),
            ...(body.endsOn !== undefined ? { endsOn: body.endsOn } : {}),
          })
          .where(eq(s.subscriptions.id, sub.row.id));
        if (body.items) {
          await tx.delete(s.subscriptionItems).where(eq(s.subscriptionItems.subscriptionId, sub.row.id));
          await tx.insert(s.subscriptionItems).values(itemRows(sub.row.id, pattern, body.items));
        }
      });
      return render(req, await getOwnedSubscription(db, customerId, sub.row.id));
    },
  );

  app.post(
    '/subscriptions/:subscriptionId/pauses',
    {
      config: cfg,
      schema: {
        tags: ['Subscriptions'],
        summary: 'Pause a date range',
        params: IdParam('subscriptionId'),
        body: Type.Object({ startsOn: DateSchema, endsOn: DateSchema }, { additionalProperties: false }),
        response: { 201: Type.Object({ id: Type.String(), startsOn: Type.String(), endsOn: Type.String() }), ...ErrorResponses },
      },
    },
    async (req, reply) => {
      const auth = requireAuth(req);
      const sub = await getOwnedSubscription(db, auth.sub, req.params.subscriptionId);
      if (sub.row.status !== 'active') throw new AppError('CONFLICT', 409, 'This subscription is cancelled');
      const slot = await getSlot(db, sub.row.slotId);
      const firstOpen = await slotFirstOpenDate(db, slot, app.deps.now());
      try {
        validatePause(req.body, firstOpen);
      } catch (e) {
        rethrow(e);
      }
      const id = newId('pau');
      await db.insert(s.subscriptionPauses).values({ id, subscriptionId: sub.row.id, ...req.body, createdByType: 'customer', createdById: auth.sub });
      return reply.status(201).send({ id, ...req.body });
    },
  );

  app.delete(
    '/subscriptions/:subscriptionId/pauses/:pauseId',
    {
      config: cfg,
      schema: {
        tags: ['Subscriptions'],
        summary: 'Remove a pause, or end it early if it already started',
        params: Type.Object({ subscriptionId: Type.String(), pauseId: Type.String() }),
      },
    },
    async (req, reply) => {
      const sub = await getOwnedSubscription(db, requireAuth(req).sub, req.params.subscriptionId);
      const pause = sub.pauses.find((p) => p.id === req.params.pauseId);
      if (!pause) throw notFound('Pause');
      const slot = await getSlot(db, sub.row.slotId);
      const firstOpen = await slotFirstOpenDate(db, slot, app.deps.now());
      if (pause.endsOn < firstOpen) throw new AppError('CUTOFF_PASSED', 422, 'This pause has already ended');
      if (pause.startsOn >= firstOpen) {
        await db.delete(s.subscriptionPauses).where(eq(s.subscriptionPauses.id, pause.id));
      } else {
        await db.update(s.subscriptionPauses).set({ endsOn: addDays(firstOpen, -1) }).where(eq(s.subscriptionPauses.id, pause.id));
      }
      return reply.status(204).send();
    },
  );

  app.put(
    '/subscriptions/:subscriptionId/overrides/:date',
    {
      config: cfg,
      schema: {
        tags: ['Subscriptions'],
        summary: 'Change one date (empty items skips the day)',
        params: Type.Object({ subscriptionId: Type.String(), date: DateSchema }),
        body: Type.Object(
          {
            items: Type.Array(Type.Object({ variantId: Type.String(), quantity: Type.Integer({ minimum: 0, maximum: 20 }) }, { additionalProperties: false }), {
              maxItems: 10,
            }),
          },
          { additionalProperties: false },
        ),
        response: { 200: CalendarDay, ...ErrorResponses },
      },
    },
    async (req) => {
      const customerId = requireAuth(req).sub;
      const sub = await getOwnedSubscription(db, customerId, req.params.subscriptionId);
      if (sub.row.status !== 'active') throw new AppError('CONFLICT', 409, 'This subscription is cancelled');
      const slot = await getSlot(db, sub.row.slotId);
      const { date } = req.params;
      await assertOpenDate(slot, date);
      if (date < sub.row.startsOn || (sub.row.endsOn && date > sub.row.endsOn)) {
        throw new AppError('INVALID_DELIVERY_DATE', 422, 'Date is outside this subscription');
      }
      const items = req.body.items.filter((i) => i.quantity > 0);
      if (new Set(items.map((i) => i.variantId)).size !== items.length) throw new AppError('VALIDATION_FAILED', 400, 'Duplicate products');
      const [address] = await db.select().from(s.addresses).where(eq(s.addresses.id, sub.row.addressId));
      if (items.length) await assertSubscribable(db, items.map((i) => i.variantId), address?.zoneId ?? null);
      await db
        .insert(s.subscriptionOverrides)
        .values({ subscriptionId: sub.row.id, date, items })
        .onConflictDoUpdate({ target: [s.subscriptionOverrides.subscriptionId, s.subscriptionOverrides.date], set: { items } });
      const days = await calendarDays(req, customerId, date, date);
      return days[0]!;
    },
  );

  app.delete(
    '/subscriptions/:subscriptionId/overrides/:date',
    { config: cfg, schema: { tags: ['Subscriptions'], summary: 'Undo a one-date change', params: Type.Object({ subscriptionId: Type.String(), date: DateSchema }) } },
    async (req, reply) => {
      const sub = await getOwnedSubscription(db, requireAuth(req).sub, req.params.subscriptionId);
      await assertOpenDate(await getSlot(db, sub.row.slotId), req.params.date);
      await db
        .delete(s.subscriptionOverrides)
        .where(and(eq(s.subscriptionOverrides.subscriptionId, sub.row.id), eq(s.subscriptionOverrides.date, req.params.date)));
      return reply.status(204).send();
    },
  );

  app.post(
    '/subscriptions/:subscriptionId/cancel',
    {
      config: cfg,
      schema: {
        tags: ['Subscriptions'],
        summary: 'Cancel from the next open date',
        params: IdParam('subscriptionId'),
        body: Type.Optional(
          Type.Object(
            {
              reason: Type.Optional(
                Type.Union(['moving', 'price', 'quality', 'delivery_issues', 'not_needed', 'other'].map((r) => Type.Literal(r))),
              ),
              note: Type.Optional(Type.String({ maxLength: 500 })),
            },
            { additionalProperties: false },
          ),
        ),
        response: { 200: SubscriptionOut, ...ErrorResponses },
      },
    },
    async (req) => {
      const customerId = requireAuth(req).sub;
      const sub = await getOwnedSubscription(db, customerId, req.params.subscriptionId);
      if (sub.row.status === 'cancelled') return render(req, sub);
      const firstOpen = await slotFirstOpenDate(db, await getSlot(db, sub.row.slotId), app.deps.now());
      const endsOn = addDays(firstOpen, -1);
      await db
        .update(s.subscriptions)
        .set({
          status: 'cancelled',
          endsOn: endsOn < sub.row.startsOn ? addDays(sub.row.startsOn, -1) : endsOn,
          cancelReason: req.body?.reason ?? 'other',
          cancelNote: req.body?.note ?? null,
        })
        .where(eq(s.subscriptions.id, sub.row.id));
      return render(req, await getOwnedSubscription(db, customerId, sub.row.id));
    },
  );

  /** Milk-card days for a customer between two dates (inclusive). */
  async function calendarDays(req: FastifyRequest, customerId: string, from: BusinessDate, to: BusinessDate) {
    const language = lang(req);
    const now = app.deps.now();
    const subRows = await db.select().from(s.subscriptions).where(eq(s.subscriptions.customerId, customerId));
    const subs = await loadSubscriptions(db, subRows, { from, to });
    const deliveries = await db
      .select()
      .from(s.deliveries)
      .where(and(eq(s.deliveries.customerId, customerId), gte(s.deliveries.deliveryDate, from), lte(s.deliveries.deliveryDate, to)));
    const dItems = deliveries.length
      ? await db.select().from(s.deliveryItems).where(inArray(s.deliveryItems.deliveryId, deliveries.map((d) => d.id)))
      : [];
    const slotCache = new Map<string, { slot: SlotRow; firstOpen: BusinessDate; holidays: Set<BusinessDate> }>();
    for (const sub of subs) {
      if (!slotCache.has(sub.row.slotId)) {
        const slot = await getSlot(db, sub.row.slotId);
        slotCache.set(slot.id, { slot, firstOpen: await slotFirstOpenDate(db, slot, now), holidays: await holidaySet(db, slot.sellerId, slot.id, from, to) });
      }
    }
    const allVariantIds = [...subs.flatMap((x) => x.items.map((i) => i.variantId)), ...dItems.map((i) => i.variantId), ...subs.flatMap((x) => [...x.overrides.values()].flat().map((i) => i.variantId))];
    const info = await variantInfo(db, allVariantIds);
    const nameOf = (id: string) => (language === 'hi' ? info.get(id)?.nameHi : info.get(id)?.name) ?? id;
    const today = todayIST(now);

    const out: (typeof CalendarDay.static)[] = [];
    for (let date = from; date <= to; date = addDays(date, 1)) {
      const delivery = deliveries.find((d) => d.deliveryDate === date);
      if (delivery) {
        const items = dItems.filter((i) => i.deliveryId === delivery.id);
        out.push({
          date,
          state: delivery.status,
          deliveryId: delivery.id,
          items: items.map((i) => ({ variantId: i.variantId, name: nameOf(i.variantId), quantity: i.quantity })),
          charge: money(delivery.chargePaise),
          estimatedCharge: null,
          editable: false,
          cutoffAt: null,
        });
        continue;
      }
      const totals = new Map<string, number>();
      let paused = false;
      let holiday = false;
      let editable = false;
      let cutoff: Date | null = null;
      for (const sub of subs) {
        const sc = slotCache.get(sub.row.slotId)!;
        if (sc.holidays.has(date) && date >= sub.row.startsOn) holiday = true;
        if (sub.spec.status === 'active' && sub.pauses.some((p) => date >= p.startsOn && date <= p.endsOn)) paused = true;
        const items = itemsForDate(sub.spec, date, sc.holidays);
        for (const i of items) totals.set(i.variantId, (totals.get(i.variantId) ?? 0) + i.quantity);
        if (sub.row.status === 'active' && date >= sc.firstOpen) editable = true;
        if (items.length || editable) cutoff = cutoffAt(date, sc.slot.timing);
      }
      const items = [...totals.entries()].map(([variantId, quantity]) => ({ variantId, name: nameOf(variantId), quantity }));
      const estimate = items.reduce((sum, i) => sum + (info.get(i.variantId)?.subscriptionPricePaise ?? 0) * i.quantity, 0);
      const locked = !editable && date >= today;
      const state = items.length ? (locked ? 'scheduled' : date < today ? 'none' : 'planned') : paused ? 'paused' : holiday ? 'holiday' : 'none';
      out.push({
        date,
        state,
        deliveryId: null,
        items: date < today ? [] : items,
        charge: null,
        estimatedCharge: items.length && date >= today ? money(estimate) : null,
        editable,
        cutoffAt: cutoff && date >= today ? cutoff.toISOString() : null,
      });
    }
    return out;
  }

  app.get(
    '/calendar',
    {
      config: cfg,
      schema: {
        tags: ['Subscriptions'],
        summary: 'Month view of planned and past deliveries (the milk card)',
        querystring: Type.Object({ month: Month }),
        response: {
          200: Type.Object({
            month: Type.String(),
            today: Type.String(),
            days: Type.Array(CalendarDay),
            totals: Type.Object({ deliveredDays: Type.Integer(), units: Type.Integer(), spent: Money }),
          }),
          ...ErrorResponses,
        },
      },
    },
    async (req) => {
      const customerId = requireAuth(req).sub;
      const dates = monthDates(req.query.month);
      const days = await calendarDays(req, customerId, dates[0]!, dates.at(-1)!);
      const delivered = days.filter((d) => d.state === 'delivered');
      return {
        month: req.query.month,
        today: todayIST(app.deps.now()),
        days,
        totals: {
          deliveredDays: delivered.length,
          units: delivered.reduce((n, d) => n + d.items.reduce((m, i) => m + i.quantity, 0), 0),
          spent: money(days.reduce((sum, d) => sum + (d.charge?.amount ?? 0), 0)),
        },
      };
    },
  );
}
