import { schema as s } from '@dairy/db';
import { and, eq, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { createHash } from 'node:crypto';
import { AppError } from '../lib/errors';

const TTL_HOURS = 24;
const KEY_RE = /^[A-Za-z0-9_-]{8,100}$/;

/**
 * Idempotency-Key support for routes with `config: { idempotent: true }`.
 * First request stores its response; retries with the same key and body replay it.
 */
export default fp(async function idempotencyPlugin(app: FastifyInstance) {
  app.addHook('preHandler', async (req, reply) => {
    if (!req.routeOptions.config?.idempotent) return;
    const key = req.headers['idempotency-key'];
    if (typeof key !== 'string' || !KEY_RE.test(key)) {
      throw new AppError('VALIDATION_FAILED', 400, 'Idempotency-Key header (UUID) is required for this endpoint');
    }
    const userId = req.auth?.sub ?? 'anonymous';
    const route = `${req.method} ${req.routeOptions.url}`;
    const requestHash = createHash('sha256').update(route).update(JSON.stringify(req.body ?? null)).update(JSON.stringify(req.params ?? null)).digest('base64url');
    const { db } = app.deps.db;

    const inserted = await db
      .insert(s.idempotencyKeys)
      .values({ key, userId, route, requestHash, expiresAt: new Date(app.deps.now().getTime() + TTL_HOURS * 3600_000) })
      .onConflictDoNothing()
      .returning({ key: s.idempotencyKeys.key });

    if (inserted.length === 0) {
      const [existing] = await db
        .select()
        .from(s.idempotencyKeys)
        .where(and(eq(s.idempotencyKeys.userId, userId), eq(s.idempotencyKeys.key, key)));
      if (!existing) throw new AppError('IDEMPOTENCY_IN_PROGRESS', 409, 'Retry in a moment');
      if (existing.requestHash !== requestHash || existing.route !== route) {
        throw new AppError('IDEMPOTENCY_KEY_REUSED', 409, 'This Idempotency-Key was used for a different request');
      }
      if (existing.responseStatus === null) throw new AppError('IDEMPOTENCY_IN_PROGRESS', 409, 'The first request is still running');
      reply.header('idempotent-replayed', 'true');
      return reply.status(existing.responseStatus).send(existing.responseBody);
    }
    (req as unknown as { idemKey: { key: string; userId: string } }).idemKey = { key, userId };
  });

  app.addHook('onSend', async (req, reply, payload) => {
    const idem = (req as unknown as { idemKey?: { key: string; userId: string } }).idemKey;
    if (!idem) return payload;
    const { db } = app.deps.db;
    const where = and(eq(s.idempotencyKeys.userId, idem.userId), eq(s.idempotencyKeys.key, idem.key));
    if (reply.statusCode >= 500) {
      await db.delete(s.idempotencyKeys).where(where); // allow a clean retry
      return payload;
    }
    let body: unknown = null;
    try {
      body = typeof payload === 'string' ? JSON.parse(payload) : null;
    } catch {
      body = null;
    }
    await db
      .update(s.idempotencyKeys)
      .set({ responseStatus: reply.statusCode, responseBody: sql`${JSON.stringify(body)}::jsonb` })
      .where(where);
    return payload;
  });
});
