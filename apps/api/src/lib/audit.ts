import { newId } from '@dairy/core';
import { schema as s, type DbOrTx } from '@dairy/db';
import type { FastifyRequest } from 'fastify';

/** Record a staff action with before/after values. */
export async function audit(db: DbOrTx, req: FastifyRequest, action: string, entityType: string, entityId: string, before: unknown, after: unknown) {
  await db.insert(s.auditLog).values({
    id: newId('aud'),
    actorType: req.auth?.typ ?? 'system',
    actorId: req.auth?.sub ?? null,
    action,
    entityType,
    entityId,
    before: (before as object) ?? null,
    after: (after as object) ?? null,
    requestId: req.id,
  });
}
