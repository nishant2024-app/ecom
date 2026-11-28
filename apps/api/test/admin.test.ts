import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, readyCustomer, staffHeaders, stockOf, variantIds, type TestApp } from './helpers';

let t: TestApp;
beforeAll(async () => {
  t = await createTestApp();
});
afterAll(() => t.close());

async function paidOrder(variantId: string, quantity = 1) {
  const c = await readyCustomer(t);
  const { order, payment } = (
    await t.app.inject({
      method: 'POST',
      url: '/v1/store/orders',
      headers: { ...c.headers, 'idempotency-key': crypto.randomUUID() },
      payload: { lines: [{ variantId, quantity }], addressId: c.addressId },
    })
  ).json();
  await t.app.inject({ method: 'POST', url: `/v1/dev/payments/${payment.id}/simulate`, headers: c.headers, payload: { outcome: 'success' } });
  return { order, customer: c };
}

describe('admin: fulfilment', () => {
  it('packs, ships (stock leaves) and delivers an order, with an audit trail', async () => {
    const warehouse = await staffHeaders(t, 'warehouse');
    const ids = await variantIds(t);
    const { order, customer } = await paidOrder(ids.powder500, 1);
    const onHand = async () => (await t.app.inject({ url: '/v1/admin/inventory', headers: warehouse })).json().data.find((v: { variantId: string }) => v.variantId === ids.powder500).onHand;
    const handBefore = await onHand();

    const list = (await t.app.inject({ url: '/v1/admin/orders?status=confirmed', headers: warehouse })).json();
    expect(list.data.some((o: { id: string }) => o.id === order.id)).toBe(true);
    expect((await t.app.inject({ method: 'POST', url: `/v1/admin/orders/${order.id}/ship`, headers: warehouse, payload: { courier: 'Delhivery', trackingNumber: 'DLV123' } })).json().code).toBe(
      'CONFLICT',
    );
    expect((await t.app.inject({ method: 'POST', url: `/v1/admin/orders/${order.id}/pack`, headers: warehouse })).json().status).toBe('packed');
    const shipped = (await t.app.inject({ method: 'POST', url: `/v1/admin/orders/${order.id}/ship`, headers: warehouse, payload: { courier: 'Delhivery', trackingNumber: 'DLV123' } })).json();
    expect(shipped).toMatchObject({ status: 'shipped', delivery: { courier: 'Delhivery', trackingNumber: 'DLV123' } });
    expect(await onHand()).toBe(handBefore - 1);
    expect((await t.app.inject({ method: 'POST', url: `/v1/admin/orders/${order.id}/deliver`, headers: warehouse })).json().status).toBe('delivered');

    const mine = (await t.app.inject({ url: `/v1/store/orders/${order.id}`, headers: customer.headers })).json();
    expect(mine.events.map((e: { type: string }) => e.type)).toEqual(['placed', 'pay', 'pack', 'ship', 'deliver']);
    const owner = await staffHeaders(t, 'owner');
    const log = (await t.app.inject({ url: `/v1/admin/audit-log?entityId=${order.id}`, headers: owner })).json().data;
    expect(log.map((l: { action: string }) => l.action)).toEqual(expect.arrayContaining(['order.pack', 'order.ship', 'order.deliver']));
  });

  it('cancels with refund for support, but warehouse staff cannot refund', async () => {
    const ids = await variantIds(t);
    const { order } = await paidOrder(ids.peda);
    const warehouse = await staffHeaders(t, 'warehouse');
    expect((await t.app.inject({ method: 'POST', url: `/v1/admin/orders/${order.id}/cancel`, headers: warehouse, payload: { reason: 'Damaged box' } })).json().code).toBe('FORBIDDEN');
    const support = await staffHeaders(t, 'support');
    const res = (await t.app.inject({ method: 'POST', url: `/v1/admin/orders/${order.id}/cancel`, headers: support, payload: { reason: 'Damaged box' } })).json();
    expect(res).toMatchObject({ status: 'cancelled', refunds: [{ status: 'success' }] });
  });

  it('shows a dashboard with revenue, queues and low stock', async () => {
    const owner = await staffHeaders(t, 'owner');
    const d = (await t.app.inject({ url: '/v1/admin/dashboard?days=7', headers: owner })).json();
    expect(d.series).toHaveLength(7);
    expect(d.revenue.amount).toBeGreaterThan(0);
    expect(d.lowStock.map((l: { name: string }) => l.name)).toContain('Milk Cake');
    expect(d.recentOrders.length).toBeGreaterThan(0);
    expect(d.topProducts.length).toBeGreaterThan(0);
  });
});

describe('admin: catalog and inventory', () => {
  it('creates and updates a product; content staff cannot change prices', async () => {
    const owner = await staffHeaders(t, 'owner');
    const categories = (await t.app.inject({ url: '/v1/admin/categories', headers: owner })).json().data;
    const body = {
      slug: 'khoa-mawa-tin',
      categoryId: categories[3].id,
      nameEn: 'Khoa in a Tin',
      nameHi: 'खोया',
      tagline: 'Retort-packed, 6 months',
      pack: { kind: 'can', color: '#EADBC0', accent: '#14432F' },
      status: 'active',
      variants: [{ sku: 'KH-400', packSize: '400 g tin', pricePaise: 26000, mrpPaise: 28000, weightGrams: 480, hsnCode: '0406', gstRateBps: 500, shelfLifeDays: 180 }],
    };
    const created = await t.app.inject({ method: 'POST', url: '/v1/admin/products', headers: owner, payload: body });
    expect(created.statusCode).toBe(201);
    const product = created.json();
    expect((await t.app.inject({ method: 'POST', url: '/v1/admin/products', headers: owner, payload: body })).json().code).toBe('CONFLICT');

    const content = await staffHeaders(t, 'content');
    const v = product.variants[0];
    const priceChange = await t.app.inject({
      method: 'PUT',
      url: `/v1/admin/products/${product.id}`,
      headers: content,
      payload: { ...body, variants: [{ ...body.variants[0], id: v.id, pricePaise: 25000 }] },
    });
    expect(priceChange.json().code).toBe('FORBIDDEN');
    const copyChange = await t.app.inject({
      method: 'PUT',
      url: `/v1/admin/products/${product.id}`,
      headers: content,
      payload: { ...body, tagline: 'Six-month shelf life', variants: [{ ...body.variants[0], id: v.id }] },
    });
    expect(copyChange.json().tagline).toBe('Six-month shelf life');

    // New product has no stock until a batch is recorded.
    expect((await t.app.inject('/v1/store/products/khoa-mawa-tin')).json().variants[0].inStock).toBe(false);
    const batch = await t.app.inject({
      method: 'POST',
      url: '/v1/admin/batches',
      headers: owner,
      payload: { variantId: v.id, code: 'KH-400-001', manufacturedOn: '2026-11-01', expiresOn: '2027-05-01', quantity: 50 },
    });
    expect(batch.statusCode).toBe(201);
    expect(await stockOf(t, v.id)).toBe(50);
    const adj = await t.app.inject({ method: 'POST', url: '/v1/admin/stock/adjustments', headers: owner, payload: { batchId: batch.json().id, delta: -5, kind: 'wasted', reason: 'Dented tins' } });
    expect(adj.json().onHand).toBe(45);
    expect((await t.app.inject('/v1/store/products/khoa-mawa-tin')).json().variants[0].inStock).toBe(true);
  });

  it('edits shipping zones and manages staff', async () => {
    const owner = await staffHeaders(t, 'owner');
    const zones = (await t.app.inject({ url: '/v1/admin/shipping-zones', headers: owner })).json().data;
    const local = zones.find((z: { code: string }) => z.code === 'local');
    const { code, updatedAt, sort, ...editable } = local;
    void code;
    void updatedAt;
    void sort;
    const updated = await t.app.inject({ method: 'PUT', url: '/v1/admin/shipping-zones/local', headers: owner, payload: { ...editable, freeAbovePaise: 39900 } });
    expect(updated.json().freeAbovePaise).toBe(39900);
    expect((await t.app.inject('/v1/store/shipping/estimate?pincode=411045')).json().freeAbove.amount).toBe(39900);
    await t.app.inject({ method: 'PUT', url: '/v1/admin/shipping-zones/local', headers: owner, payload: { ...editable } });

    const invite = await t.app.inject({ method: 'POST', url: '/v1/admin/staff', headers: owner, payload: { email: 'Packer@Example.in', name: 'Packer', role: 'warehouse' } });
    expect(invite.json()).toMatchObject({ email: 'packer@example.in', linked: false });
    const off = await t.app.inject({ method: 'PATCH', url: `/v1/admin/staff/${invite.json().id}`, headers: owner, payload: { status: 'deactivated' } });
    expect(off.json().status).toBe('deactivated');
  });
});

describe('admin: product delete and status', () => {
  const draft = (slug: string, sku: string, categoryId: string) => ({
    slug,
    categoryId,
    nameEn: `Test ${slug}`,
    nameHi: 'परीक्षण',
    tagline: 'x',
    pack: { kind: 'can', color: '#EADBC0', accent: '#14432F' },
    status: 'draft',
    variants: [{ sku, packSize: '100 g', pricePaise: 10000, mrpPaise: 12000, weightGrams: 120, hsnCode: '0406', gstRateBps: 500, shelfLifeDays: 90 }],
  });

  it('deletes an unused product, keeps ordered or stocked ones (archive instead), and changes status', async () => {
    const owner = await staffHeaders(t, 'owner');
    const categoryId = (await t.app.inject({ url: '/v1/admin/categories', headers: owner })).json().data[0].id;

    // Never ordered, never stocked: can be deleted.
    const unused = (await t.app.inject({ method: 'POST', url: '/v1/admin/products', headers: owner, payload: draft('delete-me', 'DEL-100', categoryId) })).json();
    expect((await t.app.inject({ method: 'PATCH', url: `/v1/admin/products/${unused.id}/status`, headers: owner, payload: { status: 'active' } })).statusCode).toBe(409); // no stock yet
    expect((await t.app.inject({ method: 'DELETE', url: `/v1/admin/products/${unused.id}`, headers: owner })).statusCode).toBe(204);
    expect((await t.app.inject({ url: `/v1/admin/products/${unused.id}`, headers: owner })).statusCode).toBe(404);
    expect((await t.app.inject({ method: 'DELETE', url: `/v1/admin/products/${unused.id}`, headers: owner })).statusCode).toBe(404);

    // Stocked product: can be shown, hidden and archived, but not deleted (stock history is kept).
    const stocked = (await t.app.inject({ method: 'POST', url: '/v1/admin/products', headers: owner, payload: draft('archive-me', 'ARC-100', categoryId) })).json();
    await t.app.inject({
      method: 'POST',
      url: '/v1/admin/batches',
      headers: owner,
      payload: { variantId: stocked.variants[0].id, code: 'ARC-1', manufacturedOn: '2026-11-01', expiresOn: '2027-05-01', quantity: 10 },
    });
    expect((await t.app.inject({ method: 'PATCH', url: `/v1/admin/products/${stocked.id}/status`, headers: owner, payload: { status: 'active' } })).json().status).toBe('active');
    expect((await t.app.inject('/v1/store/products/archive-me')).statusCode).toBe(200);
    expect((await t.app.inject({ method: 'PATCH', url: `/v1/admin/products/${stocked.id}/status`, headers: owner, payload: { status: 'archived' } })).json().status).toBe('archived');
    expect((await t.app.inject('/v1/store/products/archive-me')).statusCode).toBe(404);
    const keepStock = await t.app.inject({ method: 'DELETE', url: `/v1/admin/products/${stocked.id}`, headers: owner });
    expect(keepStock.statusCode).toBe(409);
    expect(keepStock.json().detail).toMatch(/Archive it instead/);

    // Ordered product keeps its history too.
    const ids = await variantIds(t);
    await paidOrder(ids.powder500, 1);
    const products = (await t.app.inject({ url: '/v1/admin/products', headers: owner })).json().data;
    const ordered = products.find((p: { variants: { id: string }[] }) => p.variants.some((v) => v.id === ids.powder500));
    expect((await t.app.inject({ method: 'DELETE', url: `/v1/admin/products/${ordered.id}`, headers: owner })).statusCode).toBe(409);
    expect((await t.app.inject({ url: `/v1/admin/products/${ordered.id}`, headers: owner })).statusCode).toBe(200);

    // Staff without catalog.write cannot delete or change status.
    const warehouse = await staffHeaders(t, 'warehouse');
    expect((await t.app.inject({ method: 'DELETE', url: `/v1/admin/products/${ordered.id}`, headers: warehouse })).statusCode).toBe(403);
    expect((await t.app.inject({ method: 'PATCH', url: `/v1/admin/products/${ordered.id}/status`, headers: warehouse, payload: { status: 'draft' } })).statusCode).toBe(403);
  });
});

describe('admin: quick price edit', () => {
  it('changes one size price within the MRP, needs pricing.write, and shows in the shop', async () => {
    const owner = await staffHeaders(t, 'owner');
    const content = await staffHeaders(t, 'content');
    const ids = await variantIds(t);
    const variantId = ids.powder500;
    const before = (await t.app.inject({ url: '/v1/admin/products', headers: owner }))
      .json()
      .data.flatMap((p: { variants: { id: string; price: { amount: number }; mrp: { amount: number } }[] }) => p.variants)
      .find((v: { id: string }) => v.id === variantId);

    const lower = before.price.amount - 500;
    const ok = await t.app.inject({ method: 'PATCH', url: `/v1/admin/variants/${variantId}/price`, headers: owner, payload: { pricePaise: lower } });
    expect(ok.statusCode, ok.body).toBe(200);
    expect(ok.json()).toMatchObject({ id: variantId, pricePaise: lower, mrpPaise: before.mrp.amount });
    const shop = (await t.app.inject('/v1/store/products')).json();
    const priced = JSON.stringify(shop).includes(`"amount":${lower}`);
    expect(priced).toBe(true);

    const aboveMrp = await t.app.inject({ method: 'PATCH', url: `/v1/admin/variants/${variantId}/price`, headers: owner, payload: { pricePaise: before.mrp.amount + 100 } });
    expect(aboveMrp.statusCode).toBe(400);
    expect(aboveMrp.json().detail).toMatch(/above the MRP/);
    expect((await t.app.inject({ method: 'PATCH', url: `/v1/admin/variants/${variantId}/price`, headers: owner, payload: { pricePaise: 50 } })).statusCode).toBe(400);
    expect((await t.app.inject({ method: 'PATCH', url: `/v1/admin/variants/${variantId}/price`, headers: content, payload: { pricePaise: lower } })).statusCode).toBe(403);
    expect((await t.app.inject({ method: 'PATCH', url: '/v1/admin/variants/var_nope/price', headers: owner, payload: { pricePaise: lower } })).statusCode).toBe(404);

    await t.app.inject({ method: 'PATCH', url: `/v1/admin/variants/${variantId}/price`, headers: owner, payload: { pricePaise: before.price.amount } });
  });
});

describe('admin: store details', () => {
  it('lets the owner edit legal and contact details, validates them, and keeps other roles read-only', async () => {
    const owner = await staffHeaders(t, 'owner');
    const content = await staffHeaders(t, 'content');
    const before = (await t.app.inject({ url: '/v1/admin/store', headers: owner })).json();
    expect(before).toMatchObject({ state: expect.any(String), supportEmail: expect.any(String) });

    const next = {
      ...before,
      name: 'Mulshi Farms',
      gstin: '27ABCDE1234F1Z5',
      fssaiNumber: '12345678901234',
      address: 'Gat 12, Mulshi, Pune 412108',
      supportPhone: '+91 98765 43210',
      supportEmail: 'help@mulshi.in',
    };
    const saved = await t.app.inject({ method: 'PUT', url: '/v1/admin/store', headers: owner, payload: next });
    expect(saved.statusCode, saved.body).toBe(200);
    expect(saved.json()).toMatchObject({ name: 'Mulshi Farms', gstin: '27ABCDE1234F1Z5', supportEmail: 'help@mulshi.in' });

    // The public app config (footer, policy pages, Android app) now shows the new details.
    const pub = (await t.app.inject({ url: '/v1/app-config' })).json();
    expect(pub.support).toEqual({ phone: '+91 98765 43210', email: 'help@mulshi.in' });
    expect(pub.legal).toMatchObject({ fssai: '12345678901234', address: 'Gat 12, Mulshi, Pune 412108' });

    expect((await t.app.inject({ method: 'PUT', url: '/v1/admin/store', headers: owner, payload: { ...next, fssaiNumber: '123' } })).statusCode).toBe(400);
    expect((await t.app.inject({ method: 'PUT', url: '/v1/admin/store', headers: owner, payload: { ...next, gstin: 'nope' } })).statusCode).toBe(400);
    expect((await t.app.inject({ url: '/v1/admin/store', headers: content })).statusCode).toBe(200);
    expect((await t.app.inject({ method: 'PUT', url: '/v1/admin/store', headers: content, payload: next })).statusCode).toBe(403);

    await t.app.inject({ method: 'PUT', url: '/v1/admin/store', headers: owner, payload: before });
  });
});

describe('admin tools', () => {
  it('manages categories and refuses to delete one with products', async () => {
    const t = await createTestApp();
    try {
      const headers = await staffHeaders(t, 'content');
      const created = await t.app.inject({ method: 'POST', url: '/v1/admin/categories', headers, payload: { slug: 'paneer-dry', nameEn: 'Dry paneer', nameHi: 'पनीर' } });
      expect(created.statusCode, created.body).toBe(201);
      const id = created.json().id;
      const dup = await t.app.inject({ method: 'POST', url: '/v1/admin/categories', headers, payload: { slug: 'paneer-dry', nameEn: 'Another', nameHi: 'X' } });
      expect(dup.statusCode).toBe(409);
      const list = (await t.app.inject({ method: 'GET', url: '/v1/admin/categories', headers })).json().data;
      const ghee = list.find((c: { slug: string }) => c.slug === 'ghee');
      expect(ghee.productCount).toBeGreaterThan(0);
      expect((await t.app.inject({ method: 'DELETE', url: `/v1/admin/categories/${ghee.id}`, headers })).statusCode).toBe(409);
      expect((await t.app.inject({ method: 'DELETE', url: `/v1/admin/categories/${id}`, headers })).statusCode).toBe(204);
    } finally {
      await t.close();
    }
  });

  it('exports orders as CSV and bulk-packs, reporting failures per order', async () => {
    const t = await createTestApp();
    try {
      const headers = await staffHeaders(t, 'ops_manager');
      const csv = await t.app.inject({ method: 'GET', url: '/v1/admin/orders/export.csv', headers });
      expect(csv.statusCode).toBe(200);
      expect(csv.headers['content-type']).toContain('text/csv');
      expect(csv.body.split('\r\n')[0]).toContain('Order,Placed (IST),Status');
      const confirmed = (await t.app.inject({ method: 'GET', url: '/v1/admin/orders?status=confirmed', headers })).json().data;
      const ids = confirmed.slice(0, 1).map((o: { id: string }) => o.id);
      const res = (await t.app.inject({ method: 'POST', url: '/v1/admin/orders/bulk/pack', headers, payload: { orderIds: [...ids, 'ord_missing'] } })).json();
      expect(res.packed).toEqual(ids);
      expect(res.failed.map((f: { id: string }) => f.id)).toEqual(['ord_missing']);
      if (ids.length) {
        const slips = (await t.app.inject({ method: 'POST', url: '/v1/admin/orders/packing-slips', headers, payload: { orderIds: ids } })).json();
        expect(slips.data[0].status).toBe('packed');
      }
    } finally {
      await t.close();
    }
  });
});
