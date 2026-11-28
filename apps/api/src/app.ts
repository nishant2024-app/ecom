import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import swagger from '@fastify/swagger';
import scalar from '@scalar/fastify-api-reference';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { newId } from '@dairy/core';
import Fastify, { type FastifyInstance } from 'fastify';
import { createRequire } from 'node:module';
import './context';
import type { AppDeps } from './context';
import { errorHandler, sendProblem } from './lib/errors';
import { API_DESCRIPTION, API_TAGS, SCALAR_CONFIGURATION, transformOperation } from './openapi';
import { MoneySchema, Problem } from './lib/schemas';
import authPlugin from './plugins/auth';
import idempotencyPlugin from './plugins/idempotency';
import adminCatalogRoutes from './routes/admin/catalog';
import adminContentRoutes from './routes/admin/content';
import adminMediaRoutes from './routes/admin/media';
import contentRoutes from './routes/store/content';
import reviewRoutes from './routes/store/reviews';
import adminReviewRoutes from './routes/admin/reviews';
import adminCouponRoutes from './routes/admin/coupons';
import { MAX_UPLOAD_BYTES } from './services/images';
import { createStorage } from './services/storage';
import { createNominatim, noGeocoder } from './services/geocoder';
import geoRoutes from './routes/store/geo';
import { mkdirSync } from 'node:fs';
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
    logger: opts.logger ?? {
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

  deps.storage ??= createStorage(deps.config);
  deps.geocoder ??= deps.config.GEOCODER_URL === 'off' ? noGeocoder : createNominatim(deps.config, deps.kv);
  app.decorate('deps', deps);
  app.addSchema(MoneySchema);
  app.addSchema(Problem);
  // Some proxies (Google Cloud Shell's preview, for one) send an empty POST as a chunked request with no content type.
  // Accept an empty body whatever its type; any other body must still be JSON (or a file upload).
  app.addContentTypeParser('*', { parseAs: 'buffer' }, (_req, body, done) => {
    if ((body as Buffer).length === 0) return done(null, undefined);
    done(Object.assign(new Error('Send the body as JSON (Content-Type: application/json).'), { statusCode: 415, code: 'FST_ERR_CTP_INVALID_MEDIA_TYPE' }), undefined);
  });
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
    transform: transformOperation as never,
    refResolver: { buildLocalReference: (json: { $id?: string }, _base: unknown, _fragment: unknown, i: number) => json.$id ?? `def-${i}` },
    openapi: {
      openapi: '3.1.0',
      info: { title: 'Mulshi Dairy API', version: '1.0.0', description: API_DESCRIPTION },
      servers: [{ url: deps.config.PUBLIC_API_URL, description: 'API server' }],
      tags: API_TAGS,
      components: {
        securitySchemes: {
          bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
          cookieAuth: { type: 'apiKey', in: 'cookie', name: 'access_token' },
        },
      },
    },
  });
  if (!deps.config.isProduction) await app.register(scalar, { routePrefix: '/docs', configuration: SCALAR_CONFIGURATION as never });

  await app.register(multipart, { limits: { fileSize: MAX_UPLOAD_BYTES, files: 10, fields: 10 } });
  const storage = deps.storage;
  if (storage.kind === 'local' && storage.root) {
    mkdirSync(storage.root, { recursive: true });
    await app.register(fastifyStatic, {
      root: storage.root,
      prefix: '/media/',
      decorateReply: false,
      immutable: true,
      maxAge: '365d',
      setHeaders: (reply) => void reply.header('cross-origin-resource-policy', 'cross-origin'),
    });
  }

  // Friendly page for anyone who opens the API address in a browser (hidden from the OpenAPI spec).
  app.get('/', { config: { auth: 'public', rateLimit: false }, schema: { hide: true } }, async (_req, reply) => {
    const docs = deps.config.isProduction ? '' : '<li><a href="/docs">API reference</a></li>';
    return reply
      .type('text/html; charset=utf-8')
      .header('cache-control', 'public, max-age=300')
      .send(
        `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>API</title><body style="font-family:system-ui,sans-serif;max-width:32rem;margin:15vh auto;padding:0 1rem;color:#14301f"><h1>The shop API is running</h1><p>This address is for apps, not people. Use these instead:</p><ul><li><a href="${deps.config.PUBLIC_WEB_URL}">The shop</a></li>${docs}<li><a href="/v1/health/ready">Health check</a></li></ul></body>`,
      );
  });

  await app.register(authPlugin);
  await app.register(idempotencyPlugin);

  await app.register(
    async (v1) => {
      await v1.register(metaRoutes);
      await v1.register(authRoutes, { prefix: '/auth' });
      await v1.register(catalogRoutes, { prefix: '/store' });
      await v1.register(contentRoutes, { prefix: '/store' });
      await v1.register(reviewRoutes, { prefix: '/store' });
      await v1.register(geoRoutes, { prefix: '/store' });
      await v1.register(meRoutes, { prefix: '/store' });
      await v1.register(checkoutRoutes, { prefix: '/store' });
      await v1.register(orderRoutes, { prefix: '/store' });
      await v1.register(webhookRoutes, { prefix: '/webhooks' });
      if (deps.payments.name === 'mock' && !deps.config.isProduction) await v1.register(devRoutes, { prefix: '/dev' });
      await v1.register(adminMeRoutes, { prefix: '/admin' });
      await v1.register(dashboardRoutes, { prefix: '/admin' });
      await v1.register(adminOrderRoutes, { prefix: '/admin' });
      await v1.register(adminCatalogRoutes, { prefix: '/admin' });
      await v1.register(adminMediaRoutes, { prefix: '/admin' });
      await v1.register(adminContentRoutes, { prefix: '/admin' });
      await v1.register(adminReviewRoutes, { prefix: '/admin' });
      await v1.register(adminCouponRoutes, { prefix: '/admin' });
      await v1.register(adminInventoryRoutes, { prefix: '/admin' });
      await v1.register(adminPeopleRoutes, { prefix: '/admin' });
    },
    { prefix: '/v1' },
  );

  return app;
}
