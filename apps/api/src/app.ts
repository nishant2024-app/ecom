import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import scalar from '@scalar/fastify-api-reference';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { newId } from '@dairy/core';
import Fastify, { type FastifyInstance } from 'fastify';
import { createRequire } from 'node:module';
import './context';
import type { AppDeps } from './context';
import { errorHandler, sendProblem } from './lib/errors';
import { MoneySchema, Problem } from './lib/schemas';
import authPlugin from './plugins/auth';
import idempotencyPlugin from './plugins/idempotency';
import adminCatalogRoutes from './routes/admin/catalog';
import dashboardRoutes from './routes/admin/dashboard';
import adminInventoryRoutes from './routes/admin/inventory';
import adminMeRoutes from './routes/admin/me';
import adminOrderRoutes from './routes/admin/orders';
import adminPeopleRoutes from './routes/admin/people';
import devRoutes from './routes/dev';
import checkoutRoutes from './routes/store/checkout';
import orderRoutes from './routes/store/orders';
import webhookRoutes from './routes/webhooks';
import authRoutes from './routes/auth';
import metaRoutes from './routes/meta';
import catalogRoutes from './routes/store/catalog';
import meRoutes from './routes/store/me';

/** pino-pretty is a dev dependency; production images don't ship it. */
function hasPrettyLogger(): boolean {
  try {
    createRequire(import.meta.url).resolve('pino-pretty');
    return true;
  } catch {
    return false;
  }
}

export async function buildApp(deps: AppDeps, opts: { logger?: boolean | object } = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger:
      opts.logger ??
      {
        level: deps.config.LOG_LEVEL,
        redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
        ...(deps.config.NODE_ENV === 'development' && hasPrettyLogger() ? { transport: { target: 'pino-pretty' } } : {}),
      },
    genReqId: () => newId('req'),
    requestIdHeader: false,
    trustProxy: true,
    ajv: { customOptions: { removeAdditional: false, coerceTypes: 'array', useDefaults: true } },
    bodyLimit: 256 * 1024,
  }).withTypeProvider<TypeBoxTypeProvider>();

  app.decorate('deps', deps);
  app.addSchema(MoneySchema);
  app.addSchema(Problem);
  app.setErrorHandler(errorHandler);
  app.setNotFoundHandler((req, reply) => sendProblem(req, reply, 'NOT_FOUND', 404, `No route for ${req.method} ${req.url.split('?')[0]}`));
  app.addHook('onSend', async (req, reply) => {
    reply.header('x-request-id', req.id);
    if (!reply.hasHeader('cache-control')) reply.header('cache-control', 'private, no-store');
  });

  await app.register(helmet, { contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'same-site' } });
  await app.register(cors, {
    origin: deps.config.corsOrigins,
    credentials: true,
    allowedHeaders: ['content-type', 'authorization', 'x-csrf-token', 'idempotency-key', 'accept-language', 'x-client', 'if-none-match'],
    exposedHeaders: ['x-request-id', 'idempotent-replayed', 'retry-after', 'etag'],
    maxAge: 600,
  });
  await app.register(cookie);
  if (deps.config.RATE_LIMIT_ENABLED) {
    await app.register(rateLimit, {
      global: true,
      max: (req) => (req.method === 'GET' ? 300 : 60),
      timeWindow: '1 minute',
      ...(deps.kv.redis ? { redis: deps.kv.redis } : {}),
      keyGenerator: (req) => req.auth?.sub ?? req.ip,
      errorResponseBuilder: (_req, ctx) => ({ statusCode: 429, message: `Retry in ${ctx.after}` }),
    });
  }

  await app.register(swagger, {
    openapi: {
      openapi: '3.1.0',
      info: { title: 'Dairy Store API', version: '1.0.0', description: 'See docs/api/README.md for conventions.' },
      servers: [{ url: deps.config.PUBLIC_API_URL }],
      components: {
        securitySchemes: {
          bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
          cookieAuth: { type: 'apiKey', in: 'cookie', name: 'access_token' },
        },
      },
    },
  });
  if (!deps.config.isProduction) await app.register(scalar, { routePrefix: '/docs' });

  await app.register(authPlugin);
  await app.register(idempotencyPlugin);

  await app.register(
    async (v1) => {
      await v1.register(metaRoutes);
      await v1.register(authRoutes, { prefix: '/auth' });
      await v1.register(catalogRoutes, { prefix: '/store' });
      await v1.register(meRoutes, { prefix: '/store' });
      await v1.register(checkoutRoutes, { prefix: '/store' });
      await v1.register(orderRoutes, { prefix: '/store' });
      await v1.register(webhookRoutes, { prefix: '/webhooks' });
      if (deps.payments.name === 'mock' && !deps.config.isProduction) await v1.register(devRoutes, { prefix: '/dev' });
      await v1.register(adminMeRoutes, { prefix: '/admin' });
      await v1.register(dashboardRoutes, { prefix: '/admin' });
      await v1.register(adminOrderRoutes, { prefix: '/admin' });
      await v1.register(adminCatalogRoutes, { prefix: '/admin' });
      await v1.register(adminInventoryRoutes, { prefix: '/admin' });
      await v1.register(adminPeopleRoutes, { prefix: '/admin' });
    },
    { prefix: '/v1' },
  );

  return app;
}
