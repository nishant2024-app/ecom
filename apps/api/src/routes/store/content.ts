import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import type { FastifyInstance } from 'fastify';
import { contentOut } from '../admin/content';
import { ContentOut } from '../content-schema';

export default async function contentRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<TypeBoxTypeProvider>();
  app.get(
    '/content',
    { config: { auth: 'public' }, schema: { tags: ['Catalog'], summary: 'Storefront copy and images (hero, story, promises, SEO)', response: { 200: ContentOut } } },
    async (_req, reply) => {
      reply.header('cache-control', 'public, max-age=60, stale-while-revalidate=300');
      return contentOut(app);
    },
  );
}
