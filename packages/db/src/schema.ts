/**
 * Database schema. Conventions: docs/05-data-model.md
 * - text ids with type prefix (see @dairy/core ids)
 * - money in bigint paise (mode: number; amounts stay far below 2^53)
 * - timestamptz in UTC; business dates as `date` strings in IST
 */
import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  customType,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  smallint,
  text,
  time,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

// ── Custom types ────────────────────────────────────────────────────────────
/** PostGIS point (SRID 4326). Written as EWKT, read back as text via ST_AsText in queries when needed. */
const geoPoint = customType<{ data: { lat: number; lng: number } | null; driverData: string | null }>({
  dataType: () => 'geography(Point, 4326)',
  toDriver: (v) => (v ? `SRID=4326;POINT(${v.lng} ${v.lat})` : null),
});
/** PostGIS multipolygon; written from GeoJSON with ST_GeomFromGeoJSON in queries. */
const geoMultiPolygon = customType<{ data: string; driverData: string }>({
  dataType: () => 'geography(MultiPolygon, 4326)',
});

const id = () => text('id').primaryKey();
const paise = (name: string) => bigint(name, { mode: 'number' });
const createdAt = () => timestamp('created_at', { withTimezone: true }).defaultNow().notNull();
const updatedAt = () =>
  timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date());
const ts = (name: string) => timestamp(name, { withTimezone: true });
const bdate = (name: string) => date(name, { mode: 'string' });

// ── Sellers, staff, agents ─────────────────────────────────────────────────
export const sellers = pgTable('sellers', {
  id: id(),
  name: text('name').notNull(),
  legalName: text('legal_name').notNull(),
  gstin: text('gstin'),
  fssaiNumber: text('fssai_number'),
  stateCode: text('state_code').notNull().default('27'),
  status: text('status').notNull().default('active'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const staff = pgTable(
  'staff',
  {
    id: id(),
    sellerId: text('seller_id').references(() => sellers.id),
    email: text('email').notNull(),
    googleSub: text('google_sub'),
    name: text('name').notNull(),
    role: text('role').notNull(),
    totpSecretEnc: text('totp_secret_enc'),
    totpEnabledAt: ts('totp_enabled_at'),
    status: text('status').notNull().default('active'),
    lastSignInAt: ts('last_sign_in_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('staff_email_uq').on(sql`lower(${t.email})`),
    uniqueIndex('staff_google_sub_uq').on(t.googleSub),
    check(
      'staff_role_ck',
      sql`${t.role} in ('owner','admin','ops_manager','dispatch','support','content','accountant')`,
    ),
    check('staff_status_ck', sql`${t.status} in ('active','deactivated')`),
  ],
);

export const agents = pgTable(
  'agents',
  {
    id: id(),
    sellerId: text('seller_id')
      .notNull()
      .references(() => sellers.id),
    email: text('email').notNull(),
    googleSub: text('google_sub'),
    name: text('name').notNull(),
    phone: text('phone'),
    status: text('status').notNull().default('active'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('agents_email_uq').on(sql`lower(${t.email})`),
    uniqueIndex('agents_google_sub_uq').on(t.googleSub),
  ],
);

// ── Customers and auth ─────────────────────────────────────────────────────
export const customers = pgTable(
  'customers',
  {
    id: id(),
    name: text('name').notNull(),
    email: text('email').notNull(),
    phone: text('phone'),
    language: text('language').notNull().default('en'),
    status: text('status').notNull().default('active'),
    defaultAddressId: text('default_address_id'),
    referralCode: text('referral_code').notNull(),
    referredBy: text('referred_by'),
    deletionRequestedAt: ts('deletion_requested_at'),
    notificationPrefs: jsonb('notification_prefs')
      .$type<Record<string, boolean>>()
      .notNull()
      .default({ marketingPush: false, marketingEmail: false, cutoffReminder: false, deliveredPush: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('customers_referral_code_uq').on(t.referralCode),
    index('customers_email_idx').on(sql`lower(${t.email})`),
    index('customers_phone_idx').on(t.phone),
    check('customers_language_ck', sql`${t.language} in ('en','hi')`),
    check('customers_status_ck', sql`${t.status} in ('active','deletion_requested','deleted')`),
  ],
);

export const authIdentities = pgTable(
  'auth_identities',
  {
    id: id(),
    userType: text('user_type').notNull(),
    userId: text('user_id').notNull(),
    provider: text('provider').notNull(),
    subject: text('subject').notNull(),
    email: text('email').notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('auth_identities_subject_uq').on(t.provider, t.subject, t.userType),
    index('auth_identities_user_idx').on(t.userType, t.userId),
  ],
);

export const sessions = pgTable(
  'sessions',
  {
    id: id(),
    userType: text('user_type').notNull(),
    userId: text('user_id').notNull(),
    client: text('client').notNull(),
    refreshTokenHash: text('refresh_token_hash').notNull(),
    previousTokenHash: text('previous_token_hash'),
    deviceName: text('device_name'),
    userAgent: text('user_agent'),
    ipPrefix: text('ip_prefix'),
    mfaPending: boolean('mfa_pending').notNull().default(false),
    expiresAt: ts('expires_at').notNull(),
    lastUsedAt: ts('last_used_at').defaultNow().notNull(),
    revokedAt: ts('revoked_at'),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('sessions_refresh_uq').on(t.refreshTokenHash),
    index('sessions_previous_idx').on(t.previousTokenHash),
    index('sessions_user_idx').on(t.userType, t.userId),
    check('sessions_client_ck', sql`${t.client} in ('web','admin','agent','android')`),
  ],
);

export const addresses = pgTable(
  'addresses',
  {
    id: id(),
    customerId: text('customer_id')
      .notNull()
      .references(() => customers.id),
    label: text('label'),
    line1: text('line1').notNull(),
    line2: text('line2'),
    landmark: text('landmark'),
    society: text('society'),
    city: text('city').notNull(),
    state: text('state').notNull(),
    pincode: text('pincode').notNull(),
    location: geoPoint('location'),
    zoneId: text('zone_id').references(() => deliveryZones.id),
    deliveryInstructions: text('delivery_instructions'),
    archivedAt: ts('archived_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('addresses_customer_idx').on(t.customerId)],
);

export const devices = pgTable(
  'devices',
  {
    id: id(),
    customerId: text('customer_id')
      .notNull()
      .references(() => customers.id),
    platform: text('platform').notNull(),
    pushToken: text('push_token').notNull(),
    appVersion: text('app_version'),
    lastSeenAt: ts('last_seen_at').defaultNow().notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('devices_token_uq').on(t.pushToken)],
);

// ── Catalog ────────────────────────────────────────────────────────────────
export const categories = pgTable(
  'categories',
  {
    id: id(),
    parentId: text('parent_id'),
    slug: text('slug').notNull(),
    nameEn: text('name_en').notNull(),
    nameHi: text('name_hi').notNull(),
    sort: integer('sort').notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('categories_slug_uq').on(t.slug)],
);

export interface ProductAttributes {
  animal?: 'cow' | 'buffalo' | 'mixed' | 'goat';
  fatPercent?: number;
  snfPercent?: number;
  pasteurised?: boolean;
  a2?: boolean;
  sourceFarm?: string;
}

export const products = pgTable(
  'products',
  {
    id: id(),
    sellerId: text('seller_id')
      .notNull()
      .references(() => sellers.id),
    categoryId: text('category_id')
      .notNull()
      .references(() => categories.id),
    slug: text('slug').notNull(),
    nameEn: text('name_en').notNull(),
    nameHi: text('name_hi').notNull(),
    descriptionEn: text('description_en').notNull().default(''),
    descriptionHi: text('description_hi').notNull().default(''),
    attributes: jsonb('attributes').$type<ProductAttributes>().notNull().default({}),
    nutrition: jsonb('nutrition').$type<{ label: string; per100: string }[]>().notNull().default([]),
    searchTerms: text('search_terms').notNull().default(''),
    isVeg: boolean('is_veg').notNull().default(true),
    status: text('status').notNull().default('draft'),
    sort: integer('sort').notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('products_slug_uq').on(t.slug),
    index('products_category_idx').on(t.categoryId, t.status),
    index('products_search_idx').using(
      'gin',
      sql`to_tsvector('simple', ${t.nameEn} || ' ' || ${t.nameHi} || ' ' || ${t.searchTerms})`,
    ),
    index('products_name_trgm_idx').using('gin', sql`${t.nameEn} gin_trgm_ops`),
    check('products_status_ck', sql`${t.status} in ('draft','active','archived')`),
  ],
);

export const productVariants = pgTable(
  'product_variants',
  {
    id: id(),
    productId: text('product_id')
      .notNull()
      .references(() => products.id),
    sellerId: text('seller_id')
      .notNull()
      .references(() => sellers.id),
    sku: text('sku').notNull(),
    packSize: text('pack_size').notNull(),
    unit: text('unit').notNull(),
    unitQuantity: integer('unit_quantity').notNull(),
    pricePaise: paise('price_paise').notNull(),
    mrpPaise: paise('mrp_paise').notNull(),
    subscriptionPricePaise: paise('subscription_price_paise'),
    hsnCode: text('hsn_code').notNull(),
    gstRateBps: integer('gst_rate_bps').notNull(),
    shelfLifeDays: integer('shelf_life_days').notNull(),
    storage: text('storage').notNull().default('chilled'),
    packaging: text('packaging').notNull().default('pouch'),
    bottleDepositPaise: paise('bottle_deposit_paise').notNull().default(0),
    subscribable: boolean('subscribable').notNull().default(false),
    status: text('status').notNull().default('active'),
    sort: integer('sort').notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('variants_sku_uq').on(t.sku),
    index('variants_product_idx').on(t.productId),
    check('variants_price_ck', sql`${t.pricePaise} > 0 and ${t.pricePaise} <= ${t.mrpPaise}`),
    check('variants_unit_ck', sql`${t.unit} in ('ml','g','pcs')`),
    check('variants_storage_ck', sql`${t.storage} in ('chilled','frozen','ambient')`),
    check('variants_packaging_ck', sql`${t.packaging} in ('pouch','bottle','tub','box')`),
    check('variants_status_ck', sql`${t.status} in ('active','archived')`),
  ],
);

export const productMedia = pgTable(
  'product_media',
  {
    id: id(),
    productId: text('product_id')
      .notNull()
      .references(() => products.id),
    kind: text('kind').notNull(),
    r2Key: text('r2_key').notNull(),
    sizes: jsonb('sizes').$type<{ width: number; format: string; key: string }[]>().notNull().default([]),
    width: integer('width'),
    height: integer('height'),
    altEn: text('alt_en').notNull().default(''),
    altHi: text('alt_hi').notNull().default(''),
    sort: integer('sort').notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index('product_media_product_idx').on(t.productId, t.sort)],
);

// ── Zones, slots, routes ───────────────────────────────────────────────────
export const deliveryZones = pgTable('delivery_zones', {
  id: id(),
  sellerId: text('seller_id')
    .notNull()
    .references(() => sellers.id),
  name: text('name').notNull(),
  area: geoMultiPolygon('area'),
  status: text('status').notNull().default('active'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const zonePincodes = pgTable(
  'zone_pincodes',
  {
    zoneId: text('zone_id')
      .notNull()
      .references(() => deliveryZones.id),
    pincode: text('pincode').notNull(),
  },
  (t) => [primaryKey({ columns: [t.zoneId, t.pincode] }), index('zone_pincodes_pincode_idx').on(t.pincode)],
);

export const zoneAvailability = pgTable(
  'zone_availability',
  {
    variantId: text('variant_id')
      .notNull()
      .references(() => productVariants.id),
    zoneId: text('zone_id')
      .notNull()
      .references(() => deliveryZones.id),
    available: boolean('available').notNull().default(true),
    maxPerDay: integer('max_per_day'),
  },
  (t) => [primaryKey({ columns: [t.variantId, t.zoneId] })],
);

export const deliverySlots = pgTable(
  'delivery_slots',
  {
    id: id(),
    sellerId: text('seller_id')
      .notNull()
      .references(() => sellers.id),
    code: text('code').notNull(),
    labelEn: text('label_en').notNull(),
    labelHi: text('label_hi').notNull(),
    startsAt: time('starts_at').notNull(),
    endsAt: time('ends_at').notNull(),
    cutoffOffsetMinutes: integer('cutoff_offset_minutes').notNull(),
    daysOfWeek: smallint('days_of_week').array().notNull().default(sql`'{0,1,2,3,4,5,6}'`),
    active: boolean('active').notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('slots_seller_code_uq').on(t.sellerId, t.code)],
);

export const holidays = pgTable(
  'holidays',
  {
    id: id(),
    sellerId: text('seller_id')
      .notNull()
      .references(() => sellers.id),
    date: bdate('date').notNull(),
    slotId: text('slot_id').references(() => deliverySlots.id),
    reason: text('reason').notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('holidays_date_idx').on(t.sellerId, t.date)],
);

export const routes = pgTable('routes', {
  id: id(),
  zoneId: text('zone_id')
    .notNull()
    .references(() => deliveryZones.id),
  name: text('name').notNull(),
  defaultAgentId: text('default_agent_id').references(() => agents.id),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const routeStops = pgTable(
  'route_stops',
  {
    routeId: text('route_id')
      .notNull()
      .references(() => routes.id),
    addressId: text('address_id')
      .notNull()
      .references(() => addresses.id),
    sequence: integer('sequence').notNull(),
  },
  (t) => [primaryKey({ columns: [t.routeId, t.addressId] }), uniqueIndex('route_stops_address_uq').on(t.addressId)],
);

// ── Subscriptions ──────────────────────────────────────────────────────────
export const subscriptions = pgTable(
  'subscriptions',
  {
    id: id(),
    customerId: text('customer_id')
      .notNull()
      .references(() => customers.id),
    sellerId: text('seller_id')
      .notNull()
      .references(() => sellers.id),
    addressId: text('address_id')
      .notNull()
      .references(() => addresses.id),
    slotId: text('slot_id')
      .notNull()
      .references(() => deliverySlots.id),
    pattern: text('pattern').notNull(),
    anchorDate: bdate('anchor_date').notNull(),
    startsOn: bdate('starts_on').notNull(),
    endsOn: bdate('ends_on'),
    status: text('status').notNull().default('active'),
    cancelReason: text('cancel_reason'),
    cancelNote: text('cancel_note'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('subscriptions_customer_idx').on(t.customerId),
    index('subscriptions_active_idx').on(t.slotId).where(sql`${t.status} = 'active'`),
    check('subscriptions_pattern_ck', sql`${t.pattern} in ('daily','alternate','weekdays')`),
    check('subscriptions_status_ck', sql`${t.status} in ('active','cancelled')`),
  ],
);

export const subscriptionItems = pgTable(
  'subscription_items',
  {
    id: id(),
    subscriptionId: text('subscription_id')
      .notNull()
      .references(() => subscriptions.id, { onDelete: 'cascade' }),
    variantId: text('variant_id')
      .notNull()
      .references(() => productVariants.id),
    quantity: integer('quantity'),
    weekdayQuantities: smallint('weekday_quantities').array(),
  },
  (t) => [uniqueIndex('subscription_items_uq').on(t.subscriptionId, t.variantId)],
);

export const subscriptionPauses = pgTable(
  'subscription_pauses',
  {
    id: id(),
    subscriptionId: text('subscription_id')
      .notNull()
      .references(() => subscriptions.id, { onDelete: 'cascade' }),
    startsOn: bdate('starts_on').notNull(),
    endsOn: bdate('ends_on').notNull(),
    createdByType: text('created_by_type').notNull().default('customer'),
    createdById: text('created_by_id'),
    createdAt: createdAt(),
  },
  (t) => [
    index('subscription_pauses_idx').on(t.subscriptionId, t.startsOn, t.endsOn),
    check('subscription_pauses_range_ck', sql`${t.endsOn} >= ${t.startsOn}`),
  ],
);

export const subscriptionOverrides = pgTable(
  'subscription_overrides',
  {
    subscriptionId: text('subscription_id')
      .notNull()
      .references(() => subscriptions.id, { onDelete: 'cascade' }),
    date: bdate('date').notNull(),
    items: jsonb('items').$type<{ variantId: string; quantity: number }[]>().notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [primaryKey({ columns: [t.subscriptionId, t.date] })],
);

// ── Orders ─────────────────────────────────────────────────────────────────
export const carts = pgTable('carts', {
  customerId: text('customer_id')
    .primaryKey()
    .references(() => customers.id),
  items: jsonb('items').$type<{ variantId: string; quantity: number }[]>().notNull().default([]),
  couponCode: text('coupon_code'),
  updatedAt: updatedAt(),
});

export const orders = pgTable(
  'orders',
  {
    id: id(),
    number: text('number').notNull(),
    customerId: text('customer_id')
      .notNull()
      .references(() => customers.id),
    addressId: text('address_id')
      .notNull()
      .references(() => addresses.id),
    slotId: text('slot_id')
      .notNull()
      .references(() => deliverySlots.id),
    deliveryDate: bdate('delivery_date').notNull(),
    status: text('status').notNull(),
    paymentMethod: text('payment_method').notNull(),
    subtotalPaise: paise('subtotal_paise').notNull(),
    discountPaise: paise('discount_paise').notNull().default(0),
    depositPaise: paise('deposit_paise').notNull().default(0),
    totalPaise: paise('total_paise').notNull(),
    couponCode: text('coupon_code'),
    paymentId: text('payment_id'),
    expiresAt: ts('expires_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('orders_number_uq').on(t.number),
    index('orders_customer_idx').on(t.customerId, t.createdAt),
    index('orders_delivery_idx').on(t.deliveryDate, t.slotId, t.status),
    check(
      'orders_status_ck',
      sql`${t.status} in ('pending_payment','confirmed','scheduled','out_for_delivery','delivered','failed','cancelled','refunded')`,
    ),
    check('orders_payment_method_ck', sql`${t.paymentMethod} in ('wallet','online')`),
  ],
);

export const orderItems = pgTable(
  'order_items',
  {
    id: id(),
    orderId: text('order_id')
      .notNull()
      .references(() => orders.id),
    variantId: text('variant_id')
      .notNull()
      .references(() => productVariants.id),
    sellerId: text('seller_id')
      .notNull()
      .references(() => sellers.id),
    nameSnapshot: text('name_snapshot').notNull(),
    skuSnapshot: text('sku_snapshot').notNull(),
    unitPricePaise: paise('unit_price_paise').notNull(),
    quantity: integer('quantity').notNull(),
    gstRateBps: integer('gst_rate_bps').notNull(),
    hsnCode: text('hsn_code').notNull(),
    lineTotalPaise: paise('line_total_paise').notNull(),
  },
  (t) => [index('order_items_order_idx').on(t.orderId)],
);

export const sellerOrders = pgTable(
  'seller_orders',
  {
    id: id(),
    orderId: text('order_id')
      .notNull()
      .references(() => orders.id),
    sellerId: text('seller_id')
      .notNull()
      .references(() => sellers.id),
    status: text('status').notNull(),
    subtotalPaise: paise('subtotal_paise').notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('seller_orders_uq').on(t.orderId, t.sellerId)],
);

export const orderEvents = pgTable(
  'order_events',
  {
    id: id(),
    orderId: text('order_id')
      .notNull()
      .references(() => orders.id),
    type: text('type').notNull(),
    fromStatus: text('from_status'),
    toStatus: text('to_status'),
    actorType: text('actor_type').notNull(),
    actorId: text('actor_id'),
    data: jsonb('data').notNull().default({}),
    at: ts('at').defaultNow().notNull(),
  },
  (t) => [index('order_events_order_idx').on(t.orderId, t.at)],
);

// ── Deliveries ─────────────────────────────────────────────────────────────
export const cutoffRuns = pgTable(
  'cutoff_runs',
  {
    id: id(),
    sellerId: text('seller_id')
      .notNull()
      .references(() => sellers.id),
    deliveryDate: bdate('delivery_date').notNull(),
    slotId: text('slot_id')
      .notNull()
      .references(() => deliverySlots.id),
    status: text('status').notNull(),
    stats: jsonb('stats').notNull().default({}),
    error: text('error'),
    startedAt: ts('started_at').defaultNow().notNull(),
    finishedAt: ts('finished_at'),
  },
  (t) => [index('cutoff_runs_date_idx').on(t.deliveryDate, t.slotId)],
);

export const runs = pgTable(
  'runs',
  {
    id: id(),
    routeId: text('route_id')
      .notNull()
      .references(() => routes.id),
    agentId: text('agent_id').references(() => agents.id),
    deliveryDate: bdate('delivery_date').notNull(),
    slotId: text('slot_id')
      .notNull()
      .references(() => deliverySlots.id),
    status: text('status').notNull().default('planned'),
    startedAt: ts('started_at'),
    completedAt: ts('completed_at'),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('runs_route_date_uq').on(t.routeId, t.deliveryDate, t.slotId)],
);

export const deliveries = pgTable(
  'deliveries',
  {
    id: id(),
    customerId: text('customer_id')
      .notNull()
      .references(() => customers.id),
    sellerId: text('seller_id')
      .notNull()
      .references(() => sellers.id),
    addressId: text('address_id')
      .notNull()
      .references(() => addresses.id),
    deliveryDate: bdate('delivery_date').notNull(),
    slotId: text('slot_id')
      .notNull()
      .references(() => deliverySlots.id),
    runId: text('run_id').references(() => runs.id),
    stopSequence: integer('stop_sequence'),
    status: text('status').notNull(),
    chargePaise: paise('charge_paise').notNull().default(0),
    chargedAt: ts('charged_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('deliveries_uq').on(t.customerId, t.addressId, t.deliveryDate, t.slotId),
    index('deliveries_dispatch_idx').on(t.deliveryDate, t.slotId, t.runId, t.stopSequence),
    index('deliveries_customer_idx').on(t.customerId, t.deliveryDate),
    check(
      'deliveries_status_ck',
      sql`${t.status} in ('scheduled','packed','out_for_delivery','delivered','not_available','refused','missed','skipped_low_balance','cancelled')`,
    ),
  ],
);

export const deliveryItems = pgTable(
  'delivery_items',
  {
    id: id(),
    deliveryId: text('delivery_id')
      .notNull()
      .references(() => deliveries.id, { onDelete: 'cascade' }),
    variantId: text('variant_id')
      .notNull()
      .references(() => productVariants.id),
    quantity: integer('quantity').notNull(),
    unitPricePaise: paise('unit_price_paise').notNull(),
    source: text('source').notNull(),
    subscriptionId: text('subscription_id').references(() => subscriptions.id),
    orderId: text('order_id').references(() => orders.id),
  },
  (t) => [index('delivery_items_delivery_idx').on(t.deliveryId)],
);

export const deliveryAllocations = pgTable(
  'delivery_allocations',
  {
    deliveryItemId: text('delivery_item_id')
      .notNull()
      .references(() => deliveryItems.id, { onDelete: 'cascade' }),
    batchId: text('batch_id')
      .notNull()
      .references(() => batches.id),
    quantity: integer('quantity').notNull(),
  },
  (t) => [primaryKey({ columns: [t.deliveryItemId, t.batchId] })],
);

export const deliveryEvents = pgTable(
  'delivery_events',
  {
    id: id(),
    deliveryId: text('delivery_id')
      .notNull()
      .references(() => deliveries.id),
    type: text('type').notNull(),
    actorType: text('actor_type').notNull(),
    actorId: text('actor_id'),
    clientEventId: text('client_event_id'),
    data: jsonb('data').notNull().default({}),
    occurredAt: ts('occurred_at').notNull(),
    receivedAt: ts('received_at').defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('delivery_events_client_uq').on(t.clientEventId),
    index('delivery_events_delivery_idx').on(t.deliveryId, t.occurredAt),
  ],
);

// ── Wallet and payments ────────────────────────────────────────────────────
export const wallets = pgTable(
  'wallets',
  {
    id: id(),
    customerId: text('customer_id')
      .notNull()
      .references(() => customers.id),
    balancePaise: paise('balance_paise').notNull().default(0),
    overdraftLimitPaise: paise('overdraft_limit_paise').notNull().default(0),
    lowBalanceThresholdPaise: paise('low_balance_threshold_paise'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('wallets_customer_uq').on(t.customerId)],
);

export const walletLedger = pgTable(
  'wallet_ledger',
  {
    id: id(),
    walletId: text('wallet_id')
      .notNull()
      .references(() => wallets.id),
    entryGroupId: text('entry_group_id').notNull(),
    account: text('account').notNull(),
    amountPaise: paise('amount_paise').notNull(),
    balanceAfterPaise: paise('balance_after_paise'),
    kind: text('kind').notNull(),
    referenceType: text('reference_type').notNull(),
    referenceId: text('reference_id').notNull(),
    memo: text('memo').notNull().default(''),
    createdByType: text('created_by_type').notNull().default('system'),
    createdById: text('created_by_id'),
    createdAt: createdAt(),
  },
  (t) => [
    index('wallet_ledger_wallet_idx').on(t.walletId, t.id),
    // One customer-side entry per (kind, reference): makes every posting idempotent.
    uniqueIndex('wallet_ledger_once_uq')
      .on(t.kind, t.referenceType, t.referenceId)
      .where(sql`${t.account} = 'customer'`),
    index('wallet_ledger_group_idx').on(t.entryGroupId),
  ],
);

export const payments = pgTable(
  'payments',
  {
    id: id(),
    customerId: text('customer_id')
      .notNull()
      .references(() => customers.id),
    purpose: text('purpose').notNull(),
    amountPaise: paise('amount_paise').notNull(),
    provider: text('provider').notNull().default('cashfree'),
    providerOrderId: text('provider_order_id'),
    providerPaymentId: text('provider_payment_id'),
    paymentSessionId: text('payment_session_id'),
    method: text('method'),
    status: text('status').notNull().default('created'),
    raw: jsonb('raw'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('payments_provider_order_uq').on(t.providerOrderId),
    index('payments_status_idx').on(t.status, t.createdAt),
    check('payments_purpose_ck', sql`${t.purpose} in ('topup','order')`),
    check(
      'payments_status_ck',
      sql`${t.status} in ('created','pending','success','failed','user_dropped','expired','refunded')`,
    ),
  ],
);

export const topups = pgTable(
  'topups',
  {
    id: id(),
    walletId: text('wallet_id')
      .notNull()
      .references(() => wallets.id),
    amountPaise: paise('amount_paise').notNull(),
    status: text('status').notNull().default('pending'),
    paymentId: text('payment_id').references(() => payments.id),
    source: text('source').notNull().default('manual'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('topups_wallet_idx').on(t.walletId, t.createdAt),
    check('topups_status_ck', sql`${t.status} in ('pending','paid','failed','expired')`),
  ],
);

export const webhookEvents = pgTable(
  'webhook_events',
  {
    id: id(),
    provider: text('provider').notNull(),
    eventKey: text('event_key').notNull(),
    type: text('type').notNull(),
    signatureValid: boolean('signature_valid').notNull(),
    payload: jsonb('payload').notNull(),
    processedAt: ts('processed_at'),
    error: text('error'),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('webhook_events_key_uq').on(t.provider, t.eventKey)],
);

// ── Inventory ──────────────────────────────────────────────────────────────
export const batches = pgTable(
  'batches',
  {
    id: id(),
    variantId: text('variant_id')
      .notNull()
      .references(() => productVariants.id),
    sellerId: text('seller_id')
      .notNull()
      .references(() => sellers.id),
    code: text('code').notNull(),
    manufacturedOn: bdate('manufactured_on').notNull(),
    expiresOn: bdate('expires_on').notNull(),
    quantityProduced: integer('quantity_produced').notNull(),
    onHand: integer('on_hand').notNull(),
    reserved: integer('reserved').notNull().default(0),
    status: text('status').notNull().default('active'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('batches_code_uq').on(t.sellerId, t.code),
    index('batches_fefo_idx').on(t.variantId, t.expiresOn).where(sql`${t.status} = 'active'`),
    check('batches_qty_ck', sql`${t.onHand} >= 0 and ${t.reserved} >= 0 and ${t.reserved} <= ${t.onHand}`),
  ],
);

export const stockMovements = pgTable(
  'stock_movements',
  {
    id: id(),
    batchId: text('batch_id')
      .notNull()
      .references(() => batches.id),
    kind: text('kind').notNull(),
    quantity: integer('quantity').notNull(),
    referenceType: text('reference_type'),
    referenceId: text('reference_id'),
    reason: text('reason'),
    createdByType: text('created_by_type').notNull().default('system'),
    createdById: text('created_by_id'),
    createdAt: createdAt(),
  },
  (t) => [index('stock_movements_batch_idx').on(t.batchId, t.createdAt)],
);

export const productionPlans = pgTable(
  'production_plans',
  {
    id: id(),
    sellerId: text('seller_id')
      .notNull()
      .references(() => sellers.id),
    deliveryDate: bdate('delivery_date').notNull(),
    slotId: text('slot_id')
      .notNull()
      .references(() => deliverySlots.id),
    lines: jsonb('lines')
      .$type<{ variantId: string; required: number; buffer: number; inStock: number; toProduce: number }[]>()
      .notNull(),
    generatedAt: ts('generated_at').defaultNow().notNull(),
  },
  (t) => [uniqueIndex('production_plans_uq').on(t.sellerId, t.deliveryDate, t.slotId)],
);

// ── Platform ───────────────────────────────────────────────────────────────
export const settings = pgTable(
  'settings',
  {
    sellerId: text('seller_id')
      .notNull()
      .references(() => sellers.id),
    key: text('key').notNull(),
    value: jsonb('value').notNull(),
    updatedAt: updatedAt(),
  },
  (t) => [primaryKey({ columns: [t.sellerId, t.key] })],
);

export const auditLog = pgTable(
  'audit_log',
  {
    id: id(),
    actorType: text('actor_type').notNull(),
    actorId: text('actor_id'),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    before: jsonb('before'),
    after: jsonb('after'),
    ipPrefix: text('ip_prefix'),
    requestId: text('request_id'),
    at: ts('at').defaultNow().notNull(),
  },
  (t) => [index('audit_entity_idx').on(t.entityType, t.entityId, t.at), index('audit_actor_idx').on(t.actorId, t.at)],
);

export const idempotencyKeys = pgTable(
  'idempotency_keys',
  {
    key: text('key').notNull(),
    userId: text('user_id').notNull(),
    route: text('route').notNull(),
    requestHash: text('request_hash').notNull(),
    responseStatus: integer('response_status'),
    responseBody: jsonb('response_body'),
    createdAt: createdAt(),
    expiresAt: ts('expires_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.key] })],
);

export const notifications = pgTable(
  'notifications',
  {
    id: id(),
    customerId: text('customer_id')
      .notNull()
      .references(() => customers.id),
    channel: text('channel').notNull(),
    template: text('template').notNull(),
    title: text('title').notNull(),
    body: text('body').notNull().default(''),
    link: text('link'),
    data: jsonb('data').notNull().default({}),
    status: text('status').notNull().default('pending'),
    sentAt: ts('sent_at'),
    readAt: ts('read_at'),
    createdAt: createdAt(),
  },
  (t) => [index('notifications_customer_idx').on(t.customerId, t.createdAt)],
);
