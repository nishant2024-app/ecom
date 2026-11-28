import { etaRange, isPincode, quoteShipping, ShippingError, stateForPincode, todayIST } from '@dairy/core';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import type { FastifyInstance } from 'fastify';
import { AppError } from '../../lib/errors';
import { ErrorResponses, Money, Nullable, money } from '../../lib/schemas';
import { quoteCart } from '../../services/quote';
import { shippingZones } from '../../services/store';
import { PackSchema } from './catalog';

export const CartLines = Type.Array(Type.Object({ variantId: Type.String({ maxLength: 40 }), quantity: Type.Integer({ minimum: 1, maximum: 50 }) }, { additionalProperties: false }), {
  minItems: 1,
  maxItems: 30,
});

const ShippingOut = Type.Object({
  zone: Type.String(),
  fee: Money,
  free: Type.Boolean(),
  remainingForFree: Money,
  etaMinDays: Type.Integer(),
  etaMaxDays: Type.Integer(),
  earliest: Type.String(),
  latest: Type.String(),
});

export default async function checkoutRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<TypeBoxTypeProvider>();
  const { db } = app.deps.db;

  app.get(
    '/shipping/estimate',
    {
      config: { auth: 'public' },
      schema: {
        tags: ['Checkout'],
        summary: 'Delivery estimate and fee rule for a pincode',
        querystring: Type.Object({ pincode: Type.String({ pattern: '^[1-9][0-9]{5}$' }), subtotal: Type.Optional(Type.Integer({ minimum: 0 })) }),
        response: {
          200: Type.Object({ serviceable: Type.Boolean(), state: Nullable(Type.String()), shipping: Nullable(ShippingOut), freeAbove: Nullable(Money), message: Nullable(Type.String()) }),
          ...ErrorResponses,
        },
      },
    },
    async (req) => {
      const { pincode, subtotal } = req.query;
      const zones = await shippingZones(db);
      try {
        const q = quoteShipping(pincode, subtotal ?? 0, 1000, zones);
        const zone = zones.find((z) => z.code === q.zoneCode)!;
        const eta = etaRange(todayIST(app.deps.now()), q.etaMinDays, q.etaMaxDays);
        return {
          serviceable: true,
          state: stateForPincode(pincode),
          shipping: { zone: q.zoneName, fee: money(q.feePaise), free: q.free, remainingForFree: money(q.remainingForFreePaise), etaMinDays: q.etaMinDays, etaMaxDays: q.etaMaxDays, ...eta },
          freeAbove: zone.freeAbovePaise === null ? null : money(zone.freeAbovePaise),
          message: null,
        };
      } catch (err) {
        if (err instanceof ShippingError) return { serviceable: false, state: stateForPincode(pincode), shipping: null, freeAbove: null, message: err.message };
        throw err;
      }
    },
  );

  app.post(
    '/checkout/quote',
    {
      config: { auth: 'public', rateLimit: { max: 120, timeWindow: '1 minute' } },
      schema: {
        tags: ['Checkout'],
        summary: 'Price a cart with live prices, stock and shipping',
        body: Type.Object({ lines: CartLines, pincode: Type.Optional(Type.String()), couponCode: Type.Optional(Type.String({ maxLength: 40 })) }, { additionalProperties: false }),
        response: {
          200: Type.Object({
            lines: Type.Array(
              Type.Object({
                variantId: Type.String(),
                slug: Type.String(),
                name: Type.String(),
                packSize: Type.String(),
                pack: PackSchema,
                quantity: Type.Integer(),
                unitPrice: Money,
                mrp: Money,
                total: Money,
                maxQuantity: Type.Integer(),
                problem: Nullable(Type.String()),
              }),
            ),
            subtotal: Money,
            discount: Money,
            coupon: Nullable(Type.Object({ code: Type.String(), description: Type.String() })),
            couponError: Nullable(Type.String()),
            taxIncluded: Money,
            weightGrams: Type.Integer(),
            shipping: Nullable(ShippingOut),
            shippingError: Nullable(Type.String()),
            total: Money,
            ok: Type.Boolean(),
          }),
          ...ErrorResponses,
        },
      },
    },
    async (req) => {
      const { lines, pincode, couponCode } = req.body;
      if (pincode !== undefined && !isPincode(pincode)) throw new AppError('VALIDATION_FAILED', 400, 'Enter a valid 6-digit pincode');
      const now = app.deps.now();
      const q = await quoteCart(db, lines, pincode, now, { couponCode, customerId: req.auth?.typ === 'customer' ? req.auth.sub : null });
      const language = req.headers['accept-language']?.startsWith('hi') ? 'hi' : 'en';
      return {
        lines: q.lines.map((l) => ({
          variantId: l.variantId,
          slug: l.slug,
          name: language === 'hi' ? l.nameHi || l.name : l.name,
          packSize: l.packSize,
          pack: l.pack,
          quantity: l.quantity,
          unitPrice: money(l.unitPricePaise),
          mrp: money(l.mrpPaise),
          total: money(l.totalPaise),
          maxQuantity: Math.min(l.maxPerOrder, l.available),
          problem: l.problem,
        })),
        subtotal: money(q.subtotalPaise),
        discount: money(q.discountPaise),
        coupon: q.coupon,
        couponError: q.couponError,
        taxIncluded: money(q.taxPaise),
        weightGrams: q.weightGrams,
        shipping: q.shipping
          ? {
              zone: q.shipping.zoneName,
              fee: money(q.shipping.feePaise),
              free: q.shipping.free,
              remainingForFree: money(q.shipping.remainingForFreePaise),
              etaMinDays: q.shipping.etaMinDays,
              etaMaxDays: q.shipping.etaMaxDays,
              ...etaRange(todayIST(now), q.shipping.etaMinDays, q.shipping.etaMaxDays),
            }
          : null,
        shippingError: q.shippingError,
        total: money(q.totalPaise),
        ok: q.ok,
      };
    },
  );
}
