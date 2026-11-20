import { schema as s } from '@dairy/db';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import { asc, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { notFound } from '../../lib/errors';
import { permissionsFor } from '../../lib/permissions';
import { requireAuth } from '../../plugins/auth';
import { defaultSellerId } from '../../services/store';

export default async function adminMeRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<TypeBoxTypeProvider>();
  const { db } = app.deps.db;

  app.get(
    '/me',
    {
      config: { auth: 'staff' },
      schema: {
        tags: ['Admin'],
        summary: 'Signed-in staff member and their permissions',
        response: {
          200: Type.Object({ id: Type.String(), name: Type.String(), email: Type.String(), role: Type.String(), permissions: Type.Array(Type.String()) }),
        },
      },
    },
    async (req) => {
      const [m] = await db.select().from(s.staff).where(eq(s.staff.id, requireAuth(req).sub));
      if (!m) throw notFound('Staff member');
      return { id: m.id, name: m.name, email: m.email, role: m.role, permissions: permissionsFor(m.role) };
    },
  );

  app.get(
    '/slots',
    {
      config: { auth: 'staff', permission: 'catalog.read' },
      schema: {
        tags: ['Admin'],
        summary: 'Delivery slots',
        response: {
          200: Type.Object({
            data: Type.Array(
              Type.Object({ id: Type.String(), code: Type.String(), label: Type.String(), startsAt: Type.String(), endsAt: Type.String(), cutoffOffsetMinutes: Type.Integer(), active: Type.Boolean() }),
            ),
          }),
        },
      },
    },
    async () => {
      const sellerId = await defaultSellerId(db);
      const rows = await db.select().from(s.deliverySlots).where(eq(s.deliverySlots.sellerId, sellerId)).orderBy(asc(s.deliverySlots.startsAt));
      return {
        data: rows.map((r) => ({ id: r.id, code: r.code, label: r.labelEn, startsAt: r.startsAt.slice(0, 5), endsAt: r.endsAt.slice(0, 5), cutoffOffsetMinutes: r.cutoffOffsetMinutes, active: r.active })),
      };
    },
  );
}
