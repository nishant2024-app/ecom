import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import { isInIndia } from '@dairy/core';
import type { FastifyInstance } from 'fastify';
import { AppError } from '../../lib/errors';
import { ErrorResponses, Nullable } from '../../lib/schemas';

export default async function geoRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<TypeBoxTypeProvider>();

  app.get(
    '/geo/reverse',
    {
      config: { auth: 'customer', rateLimit: { max: 15, timeWindow: '1 minute' } },
      schema: {
        tags: ['Profile'],
        summary: 'Suggest area, city, state and pincode for a map point (to prefill the address form)',
        description: 'Signed-in customers only, 15/min. Results are suggestions: the customer confirms or edits them. Returns all nulls when the provider has no answer.',
        querystring: Type.Object({ lat: Type.Number({ minimum: -90, maximum: 90 }), lng: Type.Number({ minimum: -180, maximum: 180 }) }),
        response: {
          200: Type.Object({ area: Nullable(Type.String()), city: Nullable(Type.String()), state: Nullable(Type.String()), pincode: Nullable(Type.String()), label: Nullable(Type.String()), provider: Type.String() }),
          ...ErrorResponses,
        },
      },
    },
    async (req) => {
      const { lat, lng } = req.query;
      if (!isInIndia(lat, lng)) throw new AppError('VALIDATION_FAILED', 400, 'We deliver only within India. Move the pin to your address.');
      const geocoder = app.deps.geocoder!;
      try {
        const r = await geocoder.reverse(lat, lng);
        return { area: null, city: null, state: null, pincode: null, label: null, ...r, provider: geocoder.name };
      } catch (err) {
        req.log.warn({ err }, 'reverse geocoding failed');
        throw new AppError('GEOCODER_UNAVAILABLE', 503, 'Could not look up this location right now. Please type your address.');
      }
    },
  );
}
