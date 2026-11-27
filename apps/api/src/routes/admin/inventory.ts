import { addDays, newId, todayIST } from '@dairy/core';
import { schema as s } from '@dairy/db';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { audit } from '../../lib/audit';
import { AppError, notFound } from '../../lib/errors';
import { BusinessDate } from '../../lib/schemas';
import { defaultSellerId } from '../../services/store';
import { MIN_SHELF_DAYS } from '../../services/stock';

export default async function adminInventoryRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<TypeBoxTypeProvider>();
  const { db } = app.deps.db;

  app.get('/inventory', { config: { auth: 'staff', permission: 'catalog.read' }, schema: { tags: ['Admin'], summary: 'Stock per variant' } }, async () => {
    const minExpiry = addDays(todayIST(app.deps.now()), MIN_SHELF_DAYS);
    const rows = await db.execute<{
      variant_id: string;
      product_id: string;
      name: string;
      pack_size: string;
      sku: string;
      on_hand: number;
      reserved: number;
      available: number;
      threshold: number;
      next_expiry: string | null;
      batches: number;
      pack: unknown;
    }>(sql`
      select v.id as variant_id, p.id as product_id, p.name_en as name, v.pack_size, v.sku, p.pack,
        coalesce(sum(b.on_hand) filter (where b.status = 'active'), 0)::int as on_hand,
        coalesce(sum(b.reserved) filter (where b.status = 'active'), 0)::int as reserved,
        coalesce(sum(b.on_hand - b.reserved) filter (where b.status = 'active' and b.expires_on >= ${minExpiry}), 0)::int as available,
        v.low_stock_threshold as threshold,
        min(b.expires_on) filter (where b.status = 'active' and b.on_hand > 0)::text as next_expiry,
        count(b.id) filter (where b.status = 'active' and b.on_hand > 0)::int as batches
      from product_variants v join products p on p.id = v.product_id left join batches b on b.variant_id = v.id
      where v.status = 'active'
      group by v.id, p.id
      order by p.sort, v.sort`);
    return {
      data: rows.map((r) => ({
        variantId: r.variant_id,
        productId: r.product_id,
        name: r.name,
        packSize: r.pack_size,
        sku: r.sku,
        pack: r.pack,
        onHand: Number(r.on_hand),
        reserved: Number(r.reserved),
        available: Number(r.available),
        lowStockThreshold: Number(r.threshold),
        low: Number(r.available) <= Number(r.threshold),
        nextExpiry: r.next_expiry,
        batches: Number(r.batches),
      })),
    };
  });

  app.get(
    '/batches',
    { config: { auth: 'staff', permission: 'catalog.read' }, schema: { tags: ['Admin'], summary: 'Batches for a variant', querystring: Type.Object({ variantId: Type.String() }) } },
    async (req) => ({
      data: await db.select().from(s.batches).where(eq(s.batches.variantId, req.query.variantId)).orderBy(asc(s.batches.expiresOn)),
      movements: await db
        .select({ m: s.stockMovements, code: s.batches.code })
        .from(s.stockMovements)
        .innerJoin(s.batches, eq(s.batches.id, s.stockMovements.batchId))
        .where(eq(s.batches.variantId, req.query.variantId))
        .orderBy(desc(s.stockMovements.createdAt))
        .limit(30)
        .then((rows) => rows.map((r) => ({ ...r.m, batchCode: r.code }))),
    }),
  );

  app.post(
    '/batches',
    {
      config: { auth: 'staff', permission: 'inventory.write' },
      schema: {
        tags: ['Admin'],
        summary: 'Record a production batch',
        body: Type.Object(
          {
            variantId: Type.String(),
            code: Type.String({ minLength: 2, maxLength: 40 }),
            manufacturedOn: BusinessDate,
            expiresOn: BusinessDate,
            quantity: Type.Integer({ minimum: 1, maximum: 1_000_000 }),
          },
          { additionalProperties: false },
        ),
      },
    },
    async (req, reply) => {
      const b = req.body;
      if (b.expiresOn <= b.manufacturedOn) throw new AppError('VALIDATION_FAILED', 400, 'Expiry must be after the manufacture date');
      const [variant] = await db.select().from(s.productVariants).where(eq(s.productVariants.id, b.variantId));
      if (!variant) throw notFound('Variant');
      const sellerId = await defaultSellerId(db);
      const [clash] = await db
        .select({ id: s.batches.id })
        .from(s.batches)
        .where(and(eq(s.batches.sellerId, sellerId), eq(s.batches.code, b.code)));
      if (clash) throw new AppError('CONFLICT', 409, `Batch ${b.code} already exists`);
      const id = newId('bat');
      await db.transaction(async (tx) => {
        await tx
          .insert(s.batches)
          .values({ id, variantId: b.variantId, sellerId, code: b.code, manufacturedOn: b.manufacturedOn, expiresOn: b.expiresOn, quantityProduced: b.quantity, onHand: b.quantity });
        await tx.insert(s.stockMovements).values({ id: newId('stm'), batchId: id, kind: 'produced', quantity: b.quantity, createdByType: 'staff', createdById: req.auth!.sub });
      });
      await audit(db, req, 'batch.create', 'batch', id, null, b);
      const [row] = await db.select().from(s.batches).where(eq(s.batches.id, id));
      return reply.status(201).send(row);
    },
  );

  app.post(
    '/stock/adjustments',
    {
      config: { auth: 'staff', permission: 'inventory.write' },
      schema: {
        tags: ['Admin'],
        summary: 'Adjust a batch (count correction, damage, wastage)',
        body: Type.Object(
          {
            batchId: Type.String(),
            delta: Type.Integer({ minimum: -1_000_000, maximum: 1_000_000 }),
            kind: Type.Union([Type.Literal('adjusted'), Type.Literal('wasted'), Type.Literal('returned')]),
            reason: Type.String({ minLength: 3, maxLength: 200 }),
          },
          { additionalProperties: false },
        ),
      },
    },
    async (req) => {
      const { batchId, delta, kind, reason } = req.body;
      if (delta === 0) throw new AppError('VALIDATION_FAILED', 400, 'Adjustment cannot be zero');
      if (kind === 'wasted' && delta > 0) throw new AppError('VALIDATION_FAILED', 400, 'Wastage must reduce stock');
      const row = await db.transaction(async (tx) => {
        const [b] = await tx.select().from(s.batches).where(eq(s.batches.id, batchId)).for('update');
        if (!b) throw notFound('Batch');
        if (b.onHand + delta < b.reserved) throw new AppError('CONFLICT', 409, `Only ${b.onHand - b.reserved} units are free in this batch; the rest is reserved for orders`);
        await tx
          .update(s.batches)
          .set({ onHand: b.onHand + delta, status: b.onHand + delta === 0 ? 'depleted' : 'active' })
          .where(eq(s.batches.id, batchId));
        await tx.insert(s.stockMovements).values({ id: newId('stm'), batchId, kind, quantity: delta, reason, createdByType: 'staff', createdById: req.auth!.sub });
        const [after] = await tx.select().from(s.batches).where(eq(s.batches.id, batchId));
        return { before: b, after: after! };
      });
      await audit(db, req, 'stock.adjust', 'batch', batchId, { onHand: row.before.onHand }, { onHand: row.after.onHand, reason });
      return row.after;
    },
  );
}
