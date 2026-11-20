import { schema as s } from '@dairy/db';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { notFound } from '../../lib/errors';
import { permissionsFor } from '../../lib/permissions';
import { requireAuth } from '../../plugins/auth';

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
        response: { 200: Type.Object({ id: Type.String(), name: Type.String(), email: Type.String(), role: Type.String(), permissions: Type.Array(Type.String()) }) },
      },
    },
    async (req) => {
      const [m] = await db.select().from(s.staff).where(eq(s.staff.id, requireAuth(req).sub));
      if (!m) throw notFound('Staff member');
      return { id: m.id, name: m.name, email: m.email, role: m.role, permissions: permissionsFor(m.role) };
    },
  );
}
