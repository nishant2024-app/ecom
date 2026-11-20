/**
 * Seed a local or staging database with a realistic starting point:
 * one seller, two Pune delivery zones, the morning slot, a dairy catalog,
 * stock batches, settings, an owner (SEED_OWNER_EMAIL) and, outside production,
 * a demo customer with a wallet and a subscription.
 *
 * GST rates below are PLACEHOLDERS. Confirm every HSN rate with the accountant.
 */
import { addDays, newId, postings, todayIST } from '@dairy/core';
import { sql } from 'drizzle-orm';
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

type V = {
  sku: string;
  packSize: string;
  unit: 'ml' | 'g' | 'pcs';
  unitQuantity: number;
  price: number;
  mrp?: number;
  sub?: number;
  shelf: number;
  packaging?: 'pouch' | 'bottle' | 'tub' | 'box';
  storage?: 'chilled' | 'frozen' | 'ambient';
  deposit?: number;
};
type P = {
  slug: string;
  category: string;
  en: string;
  hi: string;
  terms: string;
  description: string;
  attributes: s.ProductAttributes;
  hsn: string;
  gstBps: number;
  variants: V[];
};

const categoryDefs = [
  { slug: 'milk', en: 'Milk', hi: 'दूध' },
  { slug: 'curd-buttermilk', en: 'Curd & Buttermilk', hi: 'दही और छाछ' },
  { slug: 'paneer', en: 'Paneer', hi: 'पनीर' },
  { slug: 'ghee-butter', en: 'Ghee & Butter', hi: 'घी और मक्खन' },
];

const catalog: P[] = [
  {
    slug: 'toned-milk',
    category: 'milk',
    en: 'Toned Milk',
    hi: 'टोंड दूध',
    terms: 'doodh dudh milk toned cow',
    description: 'Cow milk standardised to 3% fat. Pasteurised and packed at 3 AM, at your door by 7.',
    attributes: { animal: 'cow', fatPercent: 3, snfPercent: 8.5, pasteurised: true, sourceFarm: 'Mulshi' },
    hsn: '0401',
    gstBps: 0,
    variants: [
      { sku: 'TM-500', packSize: '500 ml', unit: 'ml', unitQuantity: 500, price: 3000, sub: 2800, shelf: 2 },
      { sku: 'TM-1000', packSize: '1 L', unit: 'ml', unitQuantity: 1000, price: 5800, sub: 5500, shelf: 2 },
    ],
  },
  {
    slug: 'full-cream-milk',
    category: 'milk',
    en: 'Full Cream Milk',
    hi: 'फुल क्रीम दूध',
    terms: 'doodh dudh milk full cream buffalo bhains',
    description: 'Buffalo milk with 6% fat, for tea, sweets and set curd.',
    attributes: { animal: 'buffalo', fatPercent: 6, snfPercent: 9, pasteurised: true, sourceFarm: 'Mulshi' },
    hsn: '0401',
    gstBps: 0,
    variants: [
      { sku: 'FC-500', packSize: '500 ml', unit: 'ml', unitQuantity: 500, price: 3600, sub: 3400, shelf: 2 },
      { sku: 'FC-1000', packSize: '1 L', unit: 'ml', unitQuantity: 1000, price: 7000, sub: 6700, shelf: 2 },
    ],
  },
  {
    slug: 'a2-cow-milk',
    category: 'milk',
    en: 'A2 Gir Cow Milk',
    hi: 'ए2 गिर गाय का दूध',
    terms: 'doodh a2 gir desi cow glass bottle',
    description: 'Milk from our Gir herd, in a returnable glass bottle. Bottle deposit refunded on return.',
    attributes: { animal: 'cow', fatPercent: 4, snfPercent: 8.7, pasteurised: true, a2: true, sourceFarm: 'Mulshi' },
    hsn: '0401',
    gstBps: 0,
    variants: [
      {
        sku: 'A2-1000-GB',
        packSize: '1 L glass bottle',
        unit: 'ml',
        unitQuantity: 1000,
        price: 11000,
        sub: 10500,
        shelf: 2,
        packaging: 'bottle',
        deposit: 5000,
      },
    ],
  },
  {
    slug: 'curd',
    category: 'curd-buttermilk',
    en: 'Set Curd',
    hi: 'दही',
    terms: 'dahi curd yogurt',
    description: 'Thick set curd from toned milk. Set overnight, no gelatin.',
    attributes: { animal: 'cow', fatPercent: 3 },
    hsn: '0403',
    gstBps: 500,
    variants: [
      { sku: 'CU-400', packSize: '400 g', unit: 'g', unitQuantity: 400, price: 4500, sub: 4300, shelf: 4, packaging: 'tub' },
      { sku: 'CU-1000', packSize: '1 kg', unit: 'g', unitQuantity: 1000, price: 10000, shelf: 4, packaging: 'tub' },
    ],
  },
  {
    slug: 'chaas',
    category: 'curd-buttermilk',
    en: 'Masala Chaas',
    hi: 'मसाला छाछ',
    terms: 'chaas chhaas buttermilk mattha',
    description: 'Spiced buttermilk with roasted cumin, ginger and coriander.',
    attributes: { animal: 'cow' },
    hsn: '0403',
    gstBps: 0,
    variants: [{ sku: 'CH-500', packSize: '500 ml', unit: 'ml', unitQuantity: 500, price: 2000, sub: 1900, shelf: 3 }],
  },
  {
    slug: 'malai-paneer',
    category: 'paneer',
    en: 'Malai Paneer',
    hi: 'मलाई पनीर',
    terms: 'paneer cottage cheese malai',
    description: 'Soft paneer from full cream milk, pressed this morning.',
    attributes: { animal: 'buffalo', fatPercent: 20 },
    hsn: '0406',
    gstBps: 0,
    variants: [
      { sku: 'PN-200', packSize: '200 g', unit: 'g', unitQuantity: 200, price: 9500, shelf: 5, packaging: 'box' },
      { sku: 'PN-500', packSize: '500 g', unit: 'g', unitQuantity: 500, price: 22500, shelf: 5, packaging: 'box' },
    ],
  },
  {
    slug: 'cow-ghee',
    category: 'ghee-butter',
    en: 'Cow Ghee',
    hi: 'गाय का घी',
    terms: 'ghee ghi clarified butter',
    description: 'Slow-cooked from cultured cream. Granular texture, nutty aroma.',
    attributes: { animal: 'cow' },
    hsn: '0405',
    gstBps: 500,
    variants: [
      { sku: 'GH-500', packSize: '500 ml', unit: 'ml', unitQuantity: 500, price: 38000, shelf: 270, packaging: 'bottle', storage: 'ambient' },
      { sku: 'GH-1000', packSize: '1 L', unit: 'ml', unitQuantity: 1000, price: 74000, shelf: 270, packaging: 'bottle', storage: 'ambient' },
    ],
  },
  {
    slug: 'white-butter',
    category: 'ghee-butter',
    en: 'White Butter',
    hi: 'सफ़ेद मक्खन',
    terms: 'makhan makkhan butter white unsalted',
    description: 'Unsalted, hand-churned white butter.',
    attributes: { animal: 'cow' },
    hsn: '0405',
    gstBps: 500,
    variants: [{ sku: 'WB-200', packSize: '200 g', unit: 'g', unitQuantity: 200, price: 6500, shelf: 10, packaging: 'tub' }],
  },
];

// Approximate polygons (lng, lat) for development. Replace with real service areas.
const zoneDefs = [
  {
    name: 'Baner – Balewadi',
    pincodes: ['411045'],
    polygon: [
      [73.765, 18.548],
      [73.81, 18.548],
      [73.81, 18.585],
      [73.765, 18.585],
      [73.765, 18.548],
    ],
  },
  {
    name: 'Aundh',
    pincodes: ['411007'],
    polygon: [
      [73.795, 18.55],
      [73.825, 18.55],
      [73.825, 18.575],
      [73.795, 18.575],
      [73.795, 18.55],
    ],
  },
];

await db.transaction(async (tx) => {
  await tx.insert(s.sellers).values({
    id: sellerId,
    name: 'Mulshi Dairy',
    legalName: 'Mulshi Dairy Private Limited',
    fssaiNumber: '00000000000000',
    stateCode: '27',
  });

  const slotId = newId('slt');
  await tx.insert(s.deliverySlots).values({
    id: slotId,
    sellerId,
    code: 'morning',
    labelEn: '5–8 AM',
    labelHi: 'सुबह 5–8',
    startsAt: '05:00',
    endsAt: '08:00',
    cutoffOffsetMinutes: -420,
  });

  const zoneIds: string[] = [];
  for (const z of zoneDefs) {
    const zoneId = newId('zon');
    zoneIds.push(zoneId);
    const geojson = JSON.stringify({ type: 'MultiPolygon', coordinates: [[z.polygon]] });
    await tx.insert(s.deliveryZones).values({
      id: zoneId,
      sellerId,
      name: z.name,
      area: sql`ST_GeomFromGeoJSON(${geojson})::geography` as unknown as string,
    });
    await tx.insert(s.zonePincodes).values(z.pincodes.map((pincode) => ({ zoneId, pincode })));
    await tx.insert(s.routes).values({ id: newId('rte'), zoneId, name: `${z.name} A` });
  }

  const categoryIds = new Map<string, string>();
  for (const [i, c] of categoryDefs.entries()) {
    const cid = newId('cat');
    categoryIds.set(c.slug, cid);
    await tx.insert(s.categories).values({ id: cid, slug: c.slug, nameEn: c.en, nameHi: c.hi, sort: i });
  }

  const variantIds = new Map<string, string>();
  for (const [i, p] of catalog.entries()) {
    const productId = newId('prd');
    await tx.insert(s.products).values({
      id: productId,
      sellerId,
      categoryId: categoryIds.get(p.category)!,
      slug: p.slug,
      nameEn: p.en,
      nameHi: p.hi,
      descriptionEn: p.description,
      attributes: p.attributes,
      searchTerms: p.terms,
      status: 'active',
      sort: i,
    });
    for (const [j, v] of p.variants.entries()) {
      const variantId = newId('var');
      variantIds.set(v.sku, variantId);
      await tx.insert(s.productVariants).values({
        id: variantId,
        productId,
        sellerId,
        sku: v.sku,
        packSize: v.packSize,
        unit: v.unit,
        unitQuantity: v.unitQuantity,
        pricePaise: v.price,
        mrpPaise: v.mrp ?? v.price,
        subscriptionPricePaise: v.sub ?? null,
        hsnCode: p.hsn,
        gstRateBps: p.gstBps,
        shelfLifeDays: v.shelf,
        storage: v.storage ?? 'chilled',
        packaging: v.packaging ?? 'pouch',
        bottleDepositPaise: v.deposit ?? 0,
        subscribable: v.sub !== undefined,
        sort: j,
      });
      await tx
        .insert(s.zoneAvailability)
        .values(zoneIds.map((zoneId) => ({ variantId, zoneId, available: true })));
      await tx.insert(s.batches).values({
        id: newId('bat'),
        variantId,
        sellerId,
        code: `${v.sku}-${today.replaceAll('-', '').slice(2)}`,
        manufacturedOn: today,
        expiresOn: addDays(today, v.shelf),
        quantityProduced: 500,
        onHand: 500,
      });
    }
  }

  await tx.insert(s.settings).values(
    Object.entries({
      'wallet.minTopupPaise': 10000,
      'wallet.maxTopupPaise': 1000000,
      'wallet.maxBalancePaise': 2000000,
      'wallet.defaultOverdraftPaise': 0,
      'orders.maxDaysAhead': 14,
      'orders.minOrderValuePaise': 9900,
      'production.bufferBps': 500,
      'support.phone': '+910000000000',
      'support.email': 'support@example.in',
    }).map(([key, value]) => ({ sellerId, key, value })),
  );

  const ownerEmail = process.env.SEED_OWNER_EMAIL;
  if (ownerEmail) {
    await tx.insert(s.staff).values({ id: newId('stf'), email: ownerEmail, name: 'Owner', role: 'owner' });
    console.log(`owner staff: ${ownerEmail}`);
  }

  if (process.env.APP_ENV !== 'production') {
    const customerId = newId('cus');
    const addressId = newId('adr');
    const walletId = newId('wlt');
    await tx.insert(s.customers).values({
      id: customerId,
      name: 'Asha Verma',
      email: 'asha.demo@example.in',
      phone: '+919876543210',
      referralCode: 'ASHA50',
    });
    await tx.insert(s.addresses).values({
      id: addressId,
      customerId,
      label: 'Home',
      line1: 'B-704, Sai Residency',
      line2: 'Baner Road',
      landmark: 'Opp. D-Mart',
      society: 'Sai Residency',
      city: 'Pune',
      state: 'Maharashtra',
      pincode: '411045',
      location: { lat: 18.559, lng: 73.7868 },
      zoneId: zoneIds[0]!,
      deliveryInstructions: 'Leave at door',
    });
    await tx.update(s.customers).set({ defaultAddressId: addressId }).where(sql`id = ${customerId}`);
    const topup = postings.topup(50000);
    const groupId = newId('txg');
    await tx.insert(s.wallets).values({ id: walletId, customerId, balancePaise: topup.customerDelta });
    await tx.insert(s.walletLedger).values(
      topup.entries.map((e) => ({
        id: newId('txn'),
        walletId,
        entryGroupId: groupId,
        account: e.account,
        amountPaise: e.amount,
        balanceAfterPaise: e.account === 'customer' ? topup.customerDelta : null,
        kind: topup.kind,
        referenceType: 'seed',
        referenceId: groupId,
        memo: 'Welcome credit (demo)',
      })),
    );
    const subscriptionId = newId('sub');
    const startsOn = addDays(today, 1);
    await tx.insert(s.subscriptions).values({
      id: subscriptionId,
      customerId,
      sellerId,
      addressId,
      slotId,
      pattern: 'daily',
      anchorDate: startsOn,
      startsOn,
    });
    await tx.insert(s.subscriptionItems).values({
      id: newId('sbi'),
      subscriptionId,
      variantId: variantIds.get('TM-500')!,
      quantity: 2,
    });
    console.log('demo customer: asha.demo@example.in (wallet ₹500, 2 × Toned Milk 500 ml daily)');
  }
});

console.log(`seeded seller ${sellerId}`);
await close();
