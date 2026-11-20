import { schema as s } from '@dairy/db';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import type { FastifyInstance } from 'fastify';
import { audit } from '../../lib/audit';
import { badRequest } from '../../lib/errors';
import { loadContent, siteImages, type StoreContent } from '../../services/content';
import { defaultSellerId } from '../../services/store';
import { ContentInput, ContentOut } from '../content-schema';

export async function contentOut(app: FastifyInstance) {
  const { db } = app.deps.db;
  const content = await loadContent(db, await defaultSellerId(db));
  const imgs = await siteImages(db, app.deps.storage!, [content.hero.imageId, content.story.imageId]);
  return { ...content, images: { hero: imgs.get(content.hero.imageId ?? '') ?? null, story: imgs.get(content.story.imageId ?? '') ?? null } };
}

export default async function adminContentRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<TypeBoxTypeProvider>();
  const { db } = app.deps.db;

  app.get('/storefront', { config: { auth: 'staff', permission: 'catalog.read' }, schema: { tags: ['Admin'], summary: 'Storefront copy and images', response: { 200: ContentOut } } }, async () => contentOut(app));

  app.put(
    '/storefront',
    { config: { auth: 'staff', permission: 'catalog.write' }, schema: { tags: ['Admin'], summary: 'Update storefront copy and images', body: ContentInput, response: { 200: ContentOut } } },
    async (req) => {
      const sellerId = await defaultSellerId(db);
      const body = req.body as StoreContent;
      const ids = [body.hero.imageId, body.story.imageId].filter((x): x is string => !!x);
      const found = await siteImages(db, app.deps.storage!, ids);
      for (const id of ids) if (!found.has(id)) throw badRequest(`Image ${id} is not in the storefront image library`);
      const before = await loadContent(db, sellerId);
      await db
        .insert(s.settings)
        .values({ sellerId, key: 'storefront.content', value: body })
        .onConflictDoUpdate({ target: [s.settings.sellerId, s.settings.key], set: { value: body, updatedAt: new Date() } });
      await audit(db, req, 'storefront.update', 'settings', 'storefront.content', before, body);
      return contentOut(app);
    },
  );
}
