import { isCouponCode, newId, normalizeCouponCode } from '@dairy/core';
import { schema as s } from '@dairy/db';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import { count, desc, eq, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { audit } from '../../lib/audit';
import { AppError, notFound } from '../../lib/errors';
import { IdParam } from '../../lib/schemas';
import { defaultSellerId } from '../../services/store';

const CouponInput = Type.Object(
  {
    code: Type.String({ minLength: 3, maxLength: 24 }),
    description: Type.Optional(Type.String({ maxLength: 120 })),
    kind: Type.Union([Type.Literal('percent'), Type.Literal('fixed')]),
    /** For kind=percent, in basis points: 1000 = 10%. */
    percentBps: Type.Optional(Type.Integer({ minimum: 1, maximum: 10000 })),
    /** For kind=fixed, paise. */
    amountPaise: Type.Optional(Type.Integer({ minimum: 100, maximum: 10_000_000 })),
    maxDiscountPaise: Type.Optional(Type.Union([Type.Integer({ minimum: 100 }), Type.Null()])),
    minSubtotalPaise: Type.Optional(Type.Integer({ minimum: 0 })),
    startsAt: Type.Optional(Type.Union([Type.String({ format: 'date-time' }), Type.Null()])),
    endsAt: Type.Optional(Type.Union([Type.String({ format: 'date-time' }), Type.Null()])),
    usageLimit: Type.Optional(Type.Union([Type.Integer({ minimum: 1 }), Type.Null()])),
    perCustomerLimit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
    firstOrderOnly: Type.Optional(Type.Boolean()),
    status: Type.Optional(Type.Union([Type.Literal('active'), Type.Literal('paused')])),
  },
  { additionalProperties: false },
);

export default async function adminCouponRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<TypeBoxTypeProvider>();
  const { db } = app.deps.db;

  const out = (c: typeof s.coupons.$inferSelect, used: number, discountTotal: number) => ({
    id: c.id,
    code: c.code,
    description: c.description,
    kind: c.kind,
    percentBps: c.percentBps,
    amountPaise: c.amountPaise,
    maxDiscountPaise: c.maxDiscountPaise,
    minSubtotalPaise: c.minSubtotalPaise,
    startsAt: c.startsAt?.toISOString() ?? null,
    endsAt: c.endsAt?.toISOString() ?? null,
    usageLimit: c.usageLimit,
    perCustomerLimit: c.perCustomerLimit,
    firstOrderOnly: c.firstOrderOnly,
    status: c.status,
    used,
    discountGivenPaise: discountTotal,
  });

  async function usage(couponId: string) {
    const [r] = await db
      .select({ n: count(), sum: sql<number>`coalesce(sum(${s.couponRedemptions.amountPaise}), 0)::bigint` })
      .from(s.couponRedemptions)
      .innerJoin(s.orders, eq(s.orders.id, s.couponRedemptions.orderId))
      .where(sql`${s.couponRedemptions.couponId} = ${couponId} and ${s.orders.status} <> 'cancelled'`);
    return { used: Number(r?.n ?? 0), sum: Number(r?.sum ?? 0) };
  }

  function values(b: typeof CouponInput.static) {
    const code = normalizeCouponCode(b.code);
    if (!isCouponCode(code)) throw new AppError('VALIDATION_FAILED', 400, 'Use 3–24 letters, numbers, dash or underscore, for example DIWALI10');
    if (b.kind === 'percent' && !b.percentBps) throw new AppError('VALIDATION_FAILED', 400, 'Enter the percentage off');
    if (b.kind === 'fixed' && !b.amountPaise) throw new AppError('VALIDATION_FAILED', 400, 'Enter the rupee amount off');
    if (b.startsAt && b.endsAt && new Date(b.endsAt) <= new Date(b.startsAt)) throw new AppError('VALIDATION_FAILED', 400, 'The end date must be after the start date');
    return {
      code,
      description: b.description ?? '',
      kind: b.kind,
      percentBps: b.kind === 'percent' ? b.percentBps! : null,
      amountPaise: b.kind === 'fixed' ? b.amountPaise! : null,
      maxDiscountPaise: b.kind === 'percent' ? (b.maxDiscountPaise ?? null) : null,
      minSubtotalPaise: b.minSubtotalPaise ?? 0,
      startsAt: b.startsAt ? new Date(b.startsAt) : null,
      endsAt: b.endsAt ? new Date(b.endsAt) : null,
      usageLimit: b.usageLimit ?? null,
      perCustomerLimit: b.perCustomerLimit ?? 1,
      firstOrderOnly: b.firstOrderOnly ?? false,
      status: b.status ?? 'active',
    };
  }

  app.get('/coupons', { config: { auth: 'staff', permission: 'catalog.read' }, schema: { tags: ['Admin'], summary: 'Coupons with how often each was used' } }, async () => {
    const rows = await db.select().from(s.coupons).orderBy(desc(s.coupons.createdAt));
    // One grouped query for all coupons instead of one query per coupon.
    const totals = await db
      .select({ couponId: s.couponRedemptions.couponId, n: count(), sum: sql<number>`coalesce(sum(${s.couponRedemptions.amountPaise}), 0)::bigint` })
      .from(s.couponRedemptions)
      .innerJoin(s.orders, eq(s.orders.id, s.couponRedemptions.orderId))
      .where(sql`${s.orders.status} <> 'cancelled'`)
      .groupBy(s.couponRedemptions.couponId);
    const byCoupon = new Map(totals.map((t) => [t.couponId, t]));
    return { data: rows.map((c) => out(c, Number(byCoupon.get(c.id)?.n ?? 0), Number(byCoupon.get(c.id)?.sum ?? 0))) };
  });

  app.post('/coupons', { config: { auth: 'staff', permission: 'pricing.write' }, schema: { tags: ['Admin'], summary: 'Create a coupon', body: CouponInput } }, async (req, reply) => {
    const v = values(req.body);
    const sellerId = await defaultSellerId(db);
    const [clash] = await db
      .select({ id: s.coupons.id })
      .from(s.coupons)
      .where(sql`${s.coupons.sellerId} = ${sellerId} and ${s.coupons.code} = ${v.code}`);
    if (clash) throw new AppError('CONFLICT', 409, `The code ${v.code} already exists`);
    const [row] = await db
      .insert(s.coupons)
      .values({ id: newId('cpn'), sellerId, ...v })
      .returning();
    await audit(db, req, 'coupon.create', 'coupon', row!.id, null, row);
    return reply.status(201).send(out(row!, 0, 0));
  });

  app.put(
    '/coupons/:couponId',
    { config: { auth: 'staff', permission: 'pricing.write' }, schema: { tags: ['Admin'], summary: 'Update a coupon', params: IdParam('couponId'), body: CouponInput } },
    async (req) => {
      const [before] = await db.select().from(s.coupons).where(eq(s.coupons.id, req.params.couponId));
      if (!before) throw notFound('Coupon');
      const v = values(req.body);
      const [clash] = await db
        .select({ id: s.coupons.id })
        .from(s.coupons)
        .where(sql`${s.coupons.sellerId} = ${before.sellerId} and ${s.coupons.code} = ${v.code} and ${s.coupons.id} <> ${before.id}`);
      if (clash) throw new AppError('CONFLICT', 409, `The code ${v.code} already exists`);
      const [row] = await db
        .update(s.coupons)
        .set({ ...v, updatedAt: new Date() })
        .where(eq(s.coupons.id, before.id))
        .returning();
      await audit(db, req, 'coupon.update', 'coupon', before.id, before, row);
      const u = await usage(before.id);
      return out(row!, u.used, u.sum);
    },
  );
}
