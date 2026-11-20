import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import { sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { sendProblem } from '../lib/errors';
import { defaultSellerId, settingNumber, settingsMap } from '../services/store';

export default async function metaRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<TypeBoxTypeProvider>();
  const { db } = app.deps.db;

  app.get(
    '/health/live',
    { config: { auth: 'public', rateLimit: false }, schema: { tags: ['Meta'], summary: 'Liveness' } },
    async () => ({ status: 'ok', release: process.env.GIT_SHA ?? 'dev' }),
  );

  app.get(
    '/health/ready',
    { config: { auth: 'public', rateLimit: false }, schema: { tags: ['Meta'], summary: 'Readiness' } },
    async (req, reply) => {
      const timeout = <T>(p: Promise<T>) => Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), 500))]);
      const [database, cache] = await Promise.allSettled([timeout(db.execute(sql`select 1`)), timeout(app.deps.kv.ping())]);
      const ok = database.status === 'fulfilled' && cache.status === 'fulfilled' && cache.value === true;
      if (!ok) return sendProblem(req, reply, 'SERVICE_UNAVAILABLE', 503, `database: ${database.status}, cache: ${cache.status}`);
      return { status: 'ready' };
    },
  );

  app.get(
    '/app-config',
    {
      config: { auth: 'public' },
      schema: {
        tags: ['Meta'],
        summary: 'Minimum versions, feature flags, support and legal info',
        response: {
          200: Type.Object({
            minVersions: Type.Object({ android: Type.Integer(), web: Type.String() }),
            features: Type.Record(Type.String(), Type.Boolean()),
            support: Type.Object({ phone: Type.String(), email: Type.String() }),
            legal: Type.Object({ fssai: Type.String(), privacyUrl: Type.String(), termsUrl: Type.String() }),
            auth: Type.Object({ googleClientId: Type.String(), devSignIn: Type.Boolean() }),
            payments: Type.Object({ provider: Type.String(), environment: Type.String() }),
          }),
        },
      },
    },
    async (_req, reply) => {
      const sellerId = await defaultSellerId(db);
      const settings = await settingsMap(db, sellerId);
      const [seller] = await db.execute<{ fssai_number: string | null }>(sql`select fssai_number from sellers where id = ${sellerId}`);
      const web = app.deps.config.PUBLIC_WEB_URL;
      reply.header('cache-control', 'public, max-age=60');
      return {
        minVersions: { android: settingNumber(settings, 'app.minAndroidVersion', 1), web: '1.0.0' },
        features: { cashOnDelivery: false, guestCheckout: false },
        support: { phone: String(settings['support.phone'] ?? ''), email: String(settings['support.email'] ?? '') },
        legal: { fssai: seller?.fssai_number ?? '', privacyUrl: `${web}/privacy`, termsUrl: `${web}/terms` },
        auth: { googleClientId: app.deps.config.GOOGLE_WEB_CLIENT_ID, devSignIn: app.deps.config.AUTH_TEST_MODE && !app.deps.config.isProduction && app.deps.payments.name === 'mock' },
        payments: { provider: app.deps.payments.name, environment: app.deps.payments.environment },

      };
    },
  );
}
