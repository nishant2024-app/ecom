/**
 * Seed a local or staging database: one seller, a shelf-stable dairy catalog with stock batches,
 * pan-India shipping zones, settings, an owner (SEED_OWNER_EMAIL) and, outside production,
 * a demo customer with a few orders in different states so the admin dashboard has data.
 *
 * GST rates below are PLACEHOLDERS. Confirm every HSN rate with the accountant.
 */
import { addDays, newId, orderNumber, todayIST } from '@dairy/core';
import { eq, sql } from 'drizzle-orm';
import { createDb } from '../src/index';
import * as s from '../src/schema';

const url = process.env.DATABASE_URL ?? 'postgres://app:app@localhost:5432/dairy';
const { db, close } = createDb(url, { max: 2, appName: 'seed' });

const existing = await db.select({ id: s.sellers.id }).from(s.sellers).limit(1);
if (existing.length > 0) {
  console.log('already seeded, skipping');
  await close();
  process.exit(0);
}

const sellerId = newId('sel');
const today = todayIST();

type V = { sku: string; packSize: string; price: number; mrp?: number; grams: number; shelf: number; storage?: 'ambient' | 'cool_dry' };
type P = {
  slug: string;
  category: string;
  en: string;
  hi: string;
  tagline: string;
  terms: string;
  description: string;
  attributes: s.ProductAttributes;
  pack: s.PackVisual;
  hsn: string;
  gstBps: number;
  featured?: boolean;
  nutrition?: { label: string; per100: string }[];
  variants: V[];
};

const categoryDefs = [
  { slug: 'ghee', en: 'Ghee', hi: 'घी', blurb: 'Slow-cooked from cultured cream. Keeps for 9 months.' },
  { slug: 'milk-powder', en: 'Milk Powder', hi: 'मिल्क पाउडर', blurb: 'Spray-dried in Mulshi. Mix with water for milk any time.' },
  { slug: 'uht-flavoured', en: 'UHT & Flavoured Milk', hi: 'यूएचटी और फ्लेवर्ड दूध', blurb: 'Sealed in cartons. No fridge needed until you open it.' },
  { slug: 'condensed-sweets', en: 'Condensed Milk & Mithai', hi: 'कंडेंस्ड मिल्क और मिठाई', blurb: 'For kheer, barfi and the box you bring when visiting.' },
];

const G = '#14432F'; // forest
const catalog: P[] = [
  {
    slug: 'a2-gir-cow-ghee',
    category: 'ghee',
    en: 'A2 Gir Cow Ghee',
    hi: 'ए2 गिर गाय का घी',
    tagline: 'Bilona method, from our Gir herd',
    terms: 'ghee ghi desi a2 gir bilona cow',
    description: 'Curd from Gir cow milk, hand-churned into butter and slow-cooked over a wood fire until it turns granular and golden. Aroma of roasted nuts.',
    attributes: { animal: 'cow', a2: true, process: 'Bilona (curd-churned)', sourceFarm: 'Mulshi', ingredients: 'Cow milk fat' },
    pack: { kind: 'jar', color: '#E9B44C', accent: G },
    hsn: '0405',
    gstBps: 500,
    featured: true,
    nutrition: [
      { label: 'Energy', per100: '897 kcal' },
      { label: 'Fat', per100: '99.7 g' },
      { label: 'Saturated fat', per100: '62 g' },
      { label: 'Cholesterol', per100: '230 mg' },
    ],
    variants: [
      { sku: 'GH-A2-500', packSize: '500 ml', price: 115000, mrp: 125000, grams: 620, shelf: 270 },
      { sku: 'GH-A2-1000', packSize: '1 L', price: 220000, mrp: 240000, grams: 1150, shelf: 270 },
    ],
  },
  {
    slug: 'buffalo-ghee',
    category: 'ghee',
    en: 'Buffalo Ghee',
    hi: 'भैंस का घी',
    tagline: 'Rich, white-gold, for sweets',
    terms: 'ghee ghi buffalo bhains white',
    description: 'Made from buffalo cream. Paler and richer than cow ghee, the one grandmothers reach for when making laddoos and halwa.',
    attributes: { animal: 'buffalo', process: 'Cream-cooked', ingredients: 'Buffalo milk fat' },
    pack: { kind: 'jar', color: '#F3DFA6', accent: G },
    hsn: '0405',
    gstBps: 500,
    variants: [
      { sku: 'GH-BF-500', packSize: '500 ml', price: 54000, mrp: 58000, grams: 600, shelf: 270 },
      { sku: 'GH-BF-1000', packSize: '1 L', price: 104000, mrp: 112000, grams: 1120, shelf: 270 },
    ],
  },
  {
    slug: 'danedar-cow-ghee-tin',
    category: 'ghee',
    en: 'Danedar Cow Ghee',
    hi: 'दानेदार गाय का घी',
    tagline: 'Everyday ghee in a sealed tin',
    terms: 'ghee ghi danedar tin cow kitchen',
    description: 'Granular cow ghee for daily cooking, packed in a nitrogen-flushed tin so the last spoon tastes like the first.',
    attributes: { animal: 'cow', process: 'Cream-cooked, nitrogen-flushed', ingredients: 'Cow milk fat' },
    pack: { kind: 'tin', color: '#D79A2E', accent: G },
    hsn: '0405',
    gstBps: 500,
    variants: [
      { sku: 'GH-DN-1000', packSize: '1 L tin', price: 78000, mrp: 82000, grams: 1050, shelf: 365 },
      { sku: 'GH-DN-5000', packSize: '5 L tin', price: 375000, mrp: 399000, grams: 4800, shelf: 365 },
    ],
  },
  {
    slug: 'whole-milk-powder',
    category: 'milk-powder',
    en: 'Whole Milk Powder',
    hi: 'फुल क्रीम मिल्क पाउडर',
    tagline: '26% fat, dissolves without lumps',
    terms: 'milk powder doodh powder whole full cream',
    description: 'Full-cream milk, spray-dried within hours of milking. Eight spoons in a litre of warm water gives you whole milk for tea, kheer or travel.',
    attributes: { animal: 'cow', fatPercent: 26, process: 'Spray-dried', ingredients: 'Whole cow milk' },
    pack: { kind: 'tin', color: '#F2EBDD', accent: G },
    hsn: '0402',
    gstBps: 500,
    featured: true,
    nutrition: [
      { label: 'Energy', per100: '496 kcal' },
      { label: 'Protein', per100: '25 g' },
      { label: 'Fat', per100: '26 g' },
      { label: 'Calcium', per100: '920 mg' },
    ],
    variants: [
      { sku: 'MP-WH-500', packSize: '500 g', price: 29000, mrp: 31000, grams: 560, shelf: 365 },
      { sku: 'MP-WH-1000', packSize: '1 kg', price: 56000, mrp: 60000, grams: 1080, shelf: 365 },
    ],
  },
  {
    slug: 'skimmed-milk-powder',
    category: 'milk-powder',
    en: 'Skimmed Milk Powder',
    hi: 'स्किम्ड मिल्क पाउडर',
    tagline: 'Under 1.5% fat, 34% protein',
    terms: 'milk powder skimmed skim low fat protein',
    description: 'Fat removed before drying. High in protein, light in the cup. Good for smoothies, baking and dahi at home.',
    attributes: { animal: 'cow', fatPercent: 1.5, process: 'Spray-dried', ingredients: 'Skimmed cow milk' },
    pack: { kind: 'tin', color: '#DCE7DE', accent: G },
    hsn: '0402',
    gstBps: 500,
    variants: [{ sku: 'MP-SK-500', packSize: '500 g', price: 26000, mrp: 28000, grams: 560, shelf: 365 }],
  },
  {
    slug: 'dairy-whitener',
    category: 'milk-powder',
    en: 'Dairy Whitener',
    hi: 'डेयरी व्हाइटनर',
    tagline: 'For office chai and road trips',
    terms: 'whitener tea coffee chai powder',
    description: 'Lightly sweetened milk powder that turns any cup creamy. One spoon per cup.',
    attributes: { animal: 'cow', process: 'Spray-dried', ingredients: 'Milk solids, sugar' },
    pack: { kind: 'pouch', color: '#F4D9A6', accent: G },
    hsn: '0402',
    gstBps: 500,
    variants: [
      { sku: 'DW-200', packSize: '200 g', price: 11000, grams: 220, shelf: 365 },
      { sku: 'DW-1000', packSize: '1 kg', price: 48000, mrp: 52000, grams: 1050, shelf: 365 },
    ],
  },
  {
    slug: 'uht-toned-milk',
    category: 'uht-flavoured',
    en: 'UHT Toned Milk',
    hi: 'यूएचटी टोंड दूध',
    tagline: '3% fat, 6 months without a fridge',
    terms: 'uht milk tetra pack carton doodh toned long life',
    description: 'Heated to 140 °C for four seconds and sealed in a six-layer carton. Keeps for 180 days unopened; refrigerate once opened.',
    attributes: { animal: 'cow', fatPercent: 3, process: 'UHT, aseptic carton', ingredients: 'Toned milk' },
    pack: { kind: 'tetra', color: '#F7F4EC', accent: G },
    hsn: '0401',
    gstBps: 0,
    featured: true,
    variants: [
      { sku: 'UHT-TM-1L', packSize: '1 L carton', price: 7800, mrp: 8000, grams: 1060, shelf: 180 },
      { sku: 'UHT-TM-6L', packSize: '6 × 1 L', price: 45000, mrp: 48000, grams: 6300, shelf: 180 },
    ],
  },
  {
    slug: 'kesar-badam-milk',
    category: 'uht-flavoured',
    en: 'Kesar Badam Milk',
    hi: 'केसर बादाम दूध',
    tagline: 'Saffron, almonds, real milk',
    terms: 'kesar badam flavoured milk saffron almond',
    description: 'Toned milk with Kashmiri saffron and ground almonds, sweetened lightly. Serve chilled.',
    attributes: { animal: 'cow', process: 'UHT', ingredients: 'Toned milk, sugar, almonds (2%), saffron' },
    pack: { kind: 'tetra', color: '#F1A43C', accent: '#7A2E12' },
    hsn: '0402',
    gstBps: 500,
    featured: true,
    variants: [{ sku: 'FM-KB-6', packSize: '6 × 180 ml', price: 24000, mrp: 27000, grams: 1180, shelf: 180 }],
  },
  {
    slug: 'elaichi-milk',
    category: 'uht-flavoured',
    en: 'Elaichi Milk',
    hi: 'इलायची दूध',
    tagline: 'Green cardamom, less sugar',
    terms: 'elaichi cardamom flavoured milk',
    description: 'Toned milk with freshly ground green cardamom. Six cartons for the lunchbox week.',
    attributes: { animal: 'cow', process: 'UHT', ingredients: 'Toned milk, sugar, cardamom' },
    pack: { kind: 'tetra', color: '#BFD08E', accent: G },
    hsn: '0402',
    gstBps: 500,
    variants: [{ sku: 'FM-EL-6', packSize: '6 × 180 ml', price: 23000, mrp: 25000, grams: 1180, shelf: 180 }],
  },
  {
    slug: 'sweetened-condensed-milk',
    category: 'condensed-sweets',
    en: 'Sweetened Condensed Milk',
    hi: 'मीठा कंडेंस्ड मिल्क',
    tagline: 'Thick, caramel-toned, for mithai',
    terms: 'condensed milk milkmaid mithai dessert',
    description: 'Whole milk slowly reduced with sugar. One can makes a tray of kalakand or a pot of kheer.',
    attributes: { animal: 'cow', process: 'Vacuum-evaporated', ingredients: 'Milk, sugar' },
    pack: { kind: 'can', color: '#F3E3C2', accent: '#B4472E' },
    hsn: '0402',
    gstBps: 500,
    variants: [{ sku: 'CM-400', packSize: '400 g can', price: 15500, mrp: 16500, grams: 470, shelf: 365 }],
  },
  {
    slug: 'kandi-peda',
    category: 'condensed-sweets',
    en: 'Kandi Peda',
    hi: 'कंदी पेढा',
    tagline: 'Satara-style, browned khoa',
    terms: 'peda pedha mithai sweet khoa satara',
    description: 'Khoa roasted until deep brown, then rolled in sugar. Keeps 30 days in its sealed box.',
    attributes: { animal: 'buffalo', process: 'Roasted khoa', ingredients: 'Milk solids, sugar, cardamom' },
    pack: { kind: 'box', color: '#8E4B2E', accent: '#F1D9A7' },
    hsn: '0406',
    gstBps: 500,
    featured: true,
    variants: [{ sku: 'SW-PD-250', packSize: '250 g box', price: 22000, grams: 300, shelf: 30, storage: 'cool_dry' }],
  },
  {
    slug: 'milk-cake',
    category: 'condensed-sweets',
    en: 'Milk Cake',
    hi: 'मिल्क केक',
    tagline: 'Grainy, caramel centre',
    terms: 'milk cake kalakand mithai sweet',
    description: 'Milk reduced for hours until it sets into a grainy cake with a caramel heart. Keeps 21 days.',
    attributes: { animal: 'buffalo', process: 'Slow-reduced milk', ingredients: 'Milk, sugar, ghee' },
    pack: { kind: 'box', color: '#C58A45', accent: G },
    hsn: '0406',
    gstBps: 500,
    variants: [{ sku: 'SW-MC-250', packSize: '250 g box', price: 24000, grams: 300, shelf: 21, storage: 'cool_dry' }],
  },
];

const zones: (typeof s.shippingZones.$inferInsert)[] = [
  { code: 'local', name: 'Pune', pincodePrefixes: ['411', '412'], feePaise: 4000, freeAbovePaise: 49900, includedGrams: 2000, perExtraKgPaise: 2000, etaMinDays: 1, etaMaxDays: 2, sort: 0 },
  { code: 'state', name: 'Maharashtra & Goa', pincodePrefixes: ['40', '41', '42', '43', '44'], feePaise: 6000, freeAbovePaise: 69900, includedGrams: 2000, perExtraKgPaise: 2500, etaMinDays: 2, etaMaxDays: 4, sort: 1 },
  { code: 'national', name: 'Rest of India', pincodePrefixes: ['1', '2', '3', '4', '5', '6', '7', '8'], feePaise: 9000, freeAbovePaise: 99900, includedGrams: 2000, perExtraKgPaise: 3000, etaMinDays: 3, etaMaxDays: 6, sort: 2 },
  { code: 'remote', name: 'North East, J&K and islands', pincodePrefixes: ['18', '19', '78', '79', '744', '6825'], feePaise: 15000, freeAbovePaise: null, includedGrams: 1000, perExtraKgPaise: 5000, etaMinDays: 6, etaMaxDays: 10, sort: 3 },
  { code: 'apo', name: 'Army post offices', pincodePrefixes: ['9'], feePaise: 0, freeAbovePaise: null, includedGrams: 0, perExtraKgPaise: 0, etaMinDays: 0, etaMaxDays: 0, serviceable: false, sort: 4 },
];

const variantRows = new Map<string, { id: string; price: number; name: string; packSize: string; grams: number; hsn: string; gst: number; batchId: string }>();

await db.transaction(async (tx) => {
  await tx.insert(s.sellers).values({ id: sellerId, name: 'Mulshi Dairy', legalName: 'Mulshi Dairy Private Limited', fssaiNumber: '00000000000000', state: 'Maharashtra' });
  await tx.insert(s.shippingZones).values(zones);

  const categoryIds = new Map<string, string>();
  for (const [i, c] of categoryDefs.entries()) {
    const cid = newId('cat');
    categoryIds.set(c.slug, cid);
    await tx.insert(s.categories).values({ id: cid, slug: c.slug, nameEn: c.en, nameHi: c.hi, blurb: c.blurb, sort: i });
  }

  for (const [i, p] of catalog.entries()) {
    const productId = newId('prd');
    await tx.insert(s.products).values({
      id: productId,
      sellerId,
      categoryId: categoryIds.get(p.category)!,
      slug: p.slug,
      nameEn: p.en,
      nameHi: p.hi,
      tagline: p.tagline,
      descriptionEn: p.description,
      attributes: p.attributes,
      nutrition: p.nutrition ?? [],
      pack: p.pack,
      searchTerms: p.terms,
      featured: p.featured ?? false,
      status: 'active',
      sort: i,
    });
    for (const [j, v] of p.variants.entries()) {
      const variantId = newId('var');
      await tx.insert(s.productVariants).values({
        id: variantId,
        productId,
        sellerId,
        sku: v.sku,
        packSize: v.packSize,
        pricePaise: v.price,
        mrpPaise: v.mrp ?? v.price,
        weightGrams: v.grams,
        hsnCode: p.hsn,
        gstRateBps: p.gstBps,
        shelfLifeDays: v.shelf,
        storage: v.storage ?? 'ambient',
        sort: j,
      });
      // Two batches per variant: an older one (expires sooner, used first) and a fresh one.
      const made = (daysAgo: number) => addDays(today, -daysAgo);
      const older = { id: newId('bat'), code: `${v.sku}-A`, manufacturedOn: made(Math.min(20, Math.floor(v.shelf / 3))), qty: v.sku === 'SW-MC-250' ? 6 : 40 };
      const fresh = { id: newId('bat'), code: `${v.sku}-B`, manufacturedOn: made(2), qty: v.sku === 'SW-MC-250' ? 12 : 160 };
      for (const b of [older, fresh]) {
        await tx.insert(s.batches).values({
          id: b.id,
          variantId,
          sellerId,
          code: b.code,
          manufacturedOn: b.manufacturedOn,
          expiresOn: addDays(b.manufacturedOn, v.shelf),
          quantityProduced: b.qty,
          onHand: b.qty,
        });
        await tx.insert(s.stockMovements).values({ id: newId('stm'), batchId: b.id, kind: 'produced', quantity: b.qty, referenceType: 'seed', referenceId: b.code });
      }
      variantRows.set(v.sku, { id: variantId, price: v.price, name: p.en, packSize: v.packSize, grams: v.grams, hsn: p.hsn, gst: p.gstBps, batchId: older.id });
    }
  }

  await tx.insert(s.settings).values(
    Object.entries({
      'orders.paymentWindowMinutes': 30,
      'orders.minShelfDaysAtDispatch': 7,
      'support.phone': '+910000000000',
      'support.email': 'support@example.in',
      'store.dispatchFrom': 'Mulshi, Pune',
    }).map(([key, value]) => ({ sellerId, key, value })),
  );

  const ownerEmail = process.env.SEED_OWNER_EMAIL;
  if (ownerEmail) {
    await tx.insert(s.staff).values({ id: newId('stf'), email: ownerEmail, name: 'Owner', role: 'owner' });
    console.log(`owner staff: ${ownerEmail}`);
  }

  if (process.env.APP_ENV !== 'production') {
    const customerId = newId('cus');
    const address = {
      name: 'Asha Verma',
      phone: '+919876543210',
      line1: 'B-704, Sai Residency',
      line2: 'Baner Road',
      landmark: 'Opp. D-Mart',
      city: 'Pune',
      state: 'Maharashtra',
      pincode: '411045',
    };
    await tx.insert(s.customers).values({ id: customerId, name: 'Asha Verma', email: 'asha.demo@example.in', phone: address.phone });
    const addressId = newId('adr');
    await tx.insert(s.addresses).values({ id: addressId, customerId, label: 'Home', ...address });
    await tx.update(s.customers).set({ defaultAddressId: addressId }).where(eq(s.customers.id, customerId));

    // Sample orders across the last week, in different states.
    const samples: { daysAgo: number; status: 'delivered' | 'shipped' | 'packed' | 'confirmed'; lines: [string, number][] }[] = [
      { daysAgo: 6, status: 'delivered', lines: [['GH-A2-500', 1], ['MP-WH-500', 2]] },
      { daysAgo: 5, status: 'delivered', lines: [['UHT-TM-6L', 1]] },
      { daysAgo: 3, status: 'delivered', lines: [['SW-PD-250', 2], ['CM-400', 1]] },
      { daysAgo: 2, status: 'shipped', lines: [['GH-DN-1000', 1], ['FM-KB-6', 1]] },
      { daysAgo: 1, status: 'packed', lines: [['GH-A2-1000', 1]] },
      { daysAgo: 0, status: 'confirmed', lines: [['DW-1000', 1], ['FM-EL-6', 2]] },
    ];
    for (const [n, sample] of samples.entries()) {
      const orderId = newId('ord');
      const placedOn = addDays(today, -sample.daysAgo);
      const at = new Date(Date.parse(`${placedOn}T05:30:00Z`) + n * 60_000);
      const lines = sample.lines.map(([sku, qty]) => ({ v: variantRows.get(sku)!, qty }));
      const subtotal = lines.reduce((t, l) => t + l.v.price * l.qty, 0);
      const shipping = subtotal >= 49900 ? 0 : 4000;
      const tax = lines.reduce((t, l) => t + (l.v.gst ? l.v.price * l.qty - Math.round((l.v.price * l.qty * 10000) / (10000 + l.v.gst)) : 0), 0);
      const shipped = sample.status === 'delivered' || sample.status === 'shipped';
      await tx.insert(s.orders).values({
        id: orderId,
        number: orderNumber(placedOn, 1 + n),
        customerId,
        status: sample.status,
        subtotalPaise: subtotal,
        shippingPaise: shipping,
        taxPaise: tax,
        totalPaise: subtotal + shipping,
        shippingAddress: address,
        shippingZone: 'local',
        etaMinDays: 1,
        etaMaxDays: 2,
        placedOn,
        paidAt: at,
        packedAt: sample.status !== 'confirmed' ? at : null,
        shippedAt: shipped ? at : null,
        deliveredAt: sample.status === 'delivered' ? at : null,
        courier: shipped ? 'Delhivery' : null,
        trackingNumber: shipped ? `DLV${1000000 + n}` : null,
        createdAt: at,
      });
      await tx.insert(s.sellerOrders).values({ id: newId('ord'), orderId, sellerId, subtotalPaise: subtotal });
      await tx.insert(s.payments).values({
        id: newId('pay'),
        orderId,
        customerId,
        amountPaise: subtotal + shipping,
        provider: 'mock',
        providerOrderId: orderId,
        status: 'success',
        method: 'upi',
      });
      await tx.insert(s.orderEvents).values({ id: newId('oev'), orderId, type: 'status', fromStatus: 'pending_payment', toStatus: 'confirmed', actorType: 'system', at });
      for (const l of lines) {
        const itemId = newId('ori');
        await tx.insert(s.orderItems).values({
          id: itemId,
          orderId,
          variantId: l.v.id,
          sellerId,
          nameSnapshot: l.v.name,
          skuSnapshot: [...variantRows.entries()].find(([, x]) => x.id === l.v.id)![0],
          packSize: l.v.packSize,
          unitPricePaise: l.v.price,
          quantity: l.qty,
          weightGrams: l.v.grams * l.qty,
          gstRateBps: l.v.gst,
          hsnCode: l.v.hsn,
          lineTotalPaise: l.v.price * l.qty,
        });
        await tx.insert(s.orderAllocations).values({ orderItemId: itemId, batchId: l.v.batchId, quantity: l.qty, status: shipped ? 'shipped' : 'reserved' });
        await tx
          .update(s.batches)
          .set(shipped ? { onHand: sql`${s.batches.onHand} - ${l.qty}` } : { reserved: sql`${s.batches.reserved} + ${l.qty}` })
          .where(eq(s.batches.id, l.v.batchId));
        await tx.insert(s.stockMovements).values({ id: newId('stm'), batchId: l.v.batchId, kind: shipped ? 'shipped' : 'reserved', quantity: l.qty, referenceType: 'order', referenceId: orderId });
      }
    }
    await tx.insert(s.counters).values({ key: `orders:${today}`, value: samples.length });
    console.log('demo customer: asha.demo@example.in with 6 sample orders');
  }
});

console.log(`seeded seller ${sellerId}`);
await close();
