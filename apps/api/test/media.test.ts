import { schema as s } from '@dairy/db';
import { eq } from 'drizzle-orm';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, staffHeaders, type TestApp } from './helpers';

let t: TestApp;
beforeAll(async () => {
  t = await createTestApp();
});
afterAll(() => t.close());

const photo = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: { r: 230, g: 176, b: 75 } } })
    .jpeg()
    .toBuffer();

function multipart(files: { name: string; data: Buffer; type: string }[], fields: Record<string, string> = {}) {
  const boundary = '----dairytest' + Math.random().toString(16).slice(2);
  const chunks: Buffer[] = [];
  for (const [k, v] of Object.entries(fields)) chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`));
  for (const f of files) {
    chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${f.name}"\r\nContent-Type: ${f.type}\r\n\r\n`), f.data, Buffer.from('\r\n'));
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  return { payload: Buffer.concat(chunks), contentType: `multipart/form-data; boundary=${boundary}` };
}

describe('product photos', () => {
  it('uploads, resizes, serves, reorders and deletes photos; the storefront shows them', async () => {
    const headers = await staffHeaders(t, 'content');
    const [product] = await t.db.select().from(s.products).where(eq(s.products.slug, 'a2-gir-cow-ghee'));
    const body = multipart(
      [
        { name: 'jar.jpg', data: await photo(2400, 1800), type: 'image/jpeg' },
        { name: 'side.jpg', data: await photo(800, 800), type: 'image/jpeg' },
      ],
      { alt: 'Glass jar of A2 ghee' },
    );
    const up = await t.app.inject({ method: 'POST', url: `/v1/admin/products/${product!.id}/media`, headers: { ...headers, 'content-type': body.contentType }, payload: body.payload });
    expect(up.statusCode, up.body).toBe(201);
    const photos = up.json().data;
    expect(photos).toHaveLength(2);
    expect(photos[0].srcset.map((v: { width: number }) => v.width)).toEqual([480, 960, 1600]);
    expect(photos[0]).toMatchObject({ width: 2400, height: 1800, alt: 'Glass jar of A2 ghee' });
    expect(photos[1].srcset.map((v: { width: number }) => v.width)).toEqual([480, 800]); // never upscaled

    const file = await t.app.inject({ method: 'GET', url: new URL(photos[0].url).pathname });
    expect(file.statusCode).toBe(200);
    expect((await sharp(file.rawPayload).metadata()).format).toBe('webp');

    const reorder = await t.app.inject({ method: 'PUT', url: `/v1/admin/products/${product!.id}/media/order`, headers, payload: { ids: [photos[1].id, photos[0].id] } });
    expect(reorder.json().data[0].id).toBe(photos[1].id);

    const pdp = (await t.app.inject({ method: 'GET', url: '/v1/store/products/a2-gir-cow-ghee' })).json();
    expect(pdp.gallery).toHaveLength(2);
    expect(pdp.image.url).toBe(photos[1].url);

    const del = await t.app.inject({ method: 'DELETE', url: `/v1/admin/media/${photos[1].id}`, headers });
    expect(del.statusCode).toBe(204);
    expect((await t.app.inject({ method: 'GET', url: new URL(photos[1].url).pathname })).statusCode).toBe(404);
    await t.app.inject({ method: 'DELETE', url: `/v1/admin/media/${photos[0].id}`, headers });
  });

  it('rejects files that are not photos, or too small', async () => {
    const headers = await staffHeaders(t, 'content');
    const [product] = await t.db.select().from(s.products).limit(1);
    const notImage = multipart([{ name: 'x.jpg', data: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), type: 'image/jpeg' }]);
    const r1 = await t.app.inject({ method: 'POST', url: `/v1/admin/products/${product!.id}/media`, headers: { ...headers, 'content-type': notImage.contentType }, payload: notImage.payload });
    expect(r1.statusCode).toBe(400);
    const tiny = multipart([{ name: 't.jpg', data: await photo(200, 200), type: 'image/jpeg' }]);
    const r2 = await t.app.inject({ method: 'POST', url: `/v1/admin/products/${product!.id}/media`, headers: { ...headers, 'content-type': tiny.contentType }, payload: tiny.payload });
    expect(r2.statusCode).toBe(400);
    expect(r2.json().detail).toMatch(/400 px/);
  });

  it('warehouse staff cannot upload photos', async () => {
    const headers = await staffHeaders(t, 'warehouse');
    const [product] = await t.db.select().from(s.products).limit(1);
    const body = multipart([{ name: 'a.jpg', data: await photo(600, 600), type: 'image/jpeg' }]);
    const res = await t.app.inject({ method: 'POST', url: `/v1/admin/products/${product!.id}/media`, headers: { ...headers, 'content-type': body.contentType }, payload: body.payload });
    expect(res.statusCode).toBe(403);
  });
});

describe('storefront content', () => {
  it('has sensible defaults and saves edits with a hero image', async () => {
    const def = (await t.app.inject({ method: 'GET', url: '/v1/store/content' })).json();
    expect(def.hero.title.length).toBeGreaterThan(5);
    expect(def.images.hero).toBeNull();

    const headers = await staffHeaders(t, 'content');
    const body = multipart([{ name: 'hero.jpg', data: await photo(1800, 1200), type: 'image/jpeg' }], { alt: 'Cows grazing at dawn' });
    const up = await t.app.inject({ method: 'POST', url: '/v1/admin/site-media', headers: { ...headers, 'content-type': body.contentType }, payload: body.payload });
    expect(up.statusCode, up.body).toBe(201);
    const imageId = up.json().data[0].id;

    const { images: _i, ...content } = def;
    const save = await t.app.inject({
      method: 'PUT',
      url: '/v1/admin/storefront',
      headers,
      payload: { ...content, announcement: 'Diwali orders ship till 28 Oct', hero: { ...content.hero, imageId } },
    });
    expect(save.statusCode, save.body).toBe(200);

    const after = (await t.app.inject({ method: 'GET', url: '/v1/store/content' })).json();
    expect(after.announcement).toBe('Diwali orders ship till 28 Oct');
    expect(after.images.hero).toMatchObject({ id: imageId, alt: 'Cows grazing at dawn' });

    const bad = await t.app.inject({ method: 'PUT', url: '/v1/admin/storefront', headers, payload: { ...content, hero: { ...content.hero, imageId: 'med_nope' } } });
    expect(bad.statusCode).toBe(400);

    const inUse = await t.app.inject({ method: 'DELETE', url: `/v1/admin/site-media/${imageId}`, headers });
    expect(inUse.statusCode).toBe(409);
  });
});
