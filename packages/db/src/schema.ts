/**
 * Database schema for a shipped dairy-products store. Conventions: docs/05-data-model.md
 * - text ids with a type prefix (see @dairy/core ids)
 * - money in bigint paise (mode: number)
 * - timestamptz in UTC; business dates as `date` strings in IST
 */
import { sql } from 'drizzle-orm';
import { bigint, boolean, check, date, doublePrecision, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

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

// ── Sellers and staff ──────────────────────────────────────────────────────
export const sellers = pgTable('sellers', {
  id: id(),
  name: text('name').notNull(),
  legalName: text('legal_name').notNull(),
  gstin: text('gstin'),
  fssaiNumber: text('fssai_number'),
  state: text('state').notNull().default('Maharashtra'),
  status: text('status').notNull().default('active'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const STAFF_ROLES = ['owner', 'admin', 'ops_manager', 'warehouse', 'support', 'content', 'accountant'] as const;

export const staff = pgTable(
  'staff',
  {
    id: id(),
    sellerId: text('seller_id').references(() => sellers.id),
    email: text('email').notNull(),
    googleSub: text('google_sub'),
    name: text('name').notNull(),
    role: text('role').notNull(),
    status: text('status').notNull().default('active'),
    invitedBy: text('invited_by'),
    lastSignInAt: ts('last_sign_in_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('staff_email_uq').on(sql`lower(${t.email})`),
    uniqueIndex('staff_google_sub_uq').on(t.googleSub),
    check('staff_role_ck', sql`${t.role} in ('owner','admin','ops_manager','warehouse','support','content','accountant')`),
    check('staff_status_ck', sql`${t.status} in ('active','deactivated')`),
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
    deletionRequestedAt: ts('deletion_requested_at'),
    notificationPrefs: jsonb('notification_prefs')
      .$type<Record<string, boolean>>()
      .notNull()
      .default({ marketingEmail: false, orderUpdates: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
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
    expiresAt: ts('expires_at').notNull(),
    lastUsedAt: ts('last_used_at').defaultNow().notNull(),
    revokedAt: ts('revoked_at'),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('sessions_refresh_uq').on(t.refreshTokenHash),
    index('sessions_previous_idx').on(t.previousTokenHash),
    index('sessions_user_idx').on(t.userType, t.userId),
    check('sessions_client_ck', sql`${t.client} in ('web','admin','android')`),
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
    name: text('name').notNull(),
    phone: text('phone').notNull(),
    line1: text('line1').notNull(),
    line2: text('line2'),
    landmark: text('landmark'),
    city: text('city').notNull(),
    state: text('state').notNull(),
    pincode: text('pincode').notNull(),
    /** Exact door location from the customer's phone GPS or map pin, for the delivery partner. */
    latitude: doublePrecision('latitude'),
    longitude: doublePrecision('longitude'),
    locationAccuracyM: integer('location_accuracy_m'),
    locationSource: text('location_source'),
    archivedAt: ts('archived_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('addresses_customer_idx').on(t.customerId),
    check('addresses_location_ck', sql`(${t.latitude} is null) = (${t.longitude} is null) and (${t.latitude} is null or (${t.latitude} between 6 and 37.6 and ${t.longitude} between 68 and 97.5))`),
    check('addresses_location_source_ck', sql`${t.locationSource} is null or ${t.locationSource} in ('device','map_pin')`),
  ],
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
    slug: text('slug').notNull(),
    nameEn: text('name_en').notNull(),
    nameHi: text('name_hi').notNull(),
    blurb: text('blurb').notNull().default(''),
    sort: integer('sort').notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('categories_slug_uq').on(t.slug)],
);

export interface ProductAttributes {
  animal?: 'cow' | 'buffalo' | 'mixed';
  fatPercent?: number;
  a2?: boolean;
  process?: string;
  sourceFarm?: string;
  ingredients?: string;
}

/** How the product's pack is drawn until real photography exists (see PackShot). */
export interface PackVisual {
  kind: 'jar' | 'tin' | 'tetra' | 'can' | 'box' | 'pouch';
  color: string;
  accent: string;
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
    tagline: text('tagline').notNull().default(''),
    descriptionEn: text('description_en').notNull().default(''),
    descriptionHi: text('description_hi').notNull().default(''),
    attributes: jsonb('attributes').$type<ProductAttributes>().notNull().default({}),
    nutrition: jsonb('nutrition').$type<{ label: string; per100: string }[]>().notNull().default([]),
    pack: jsonb('pack').$type<PackVisual>().notNull().default({ kind: 'jar', color: '#E8B04B', accent: '#14432F' }),
    searchTerms: text('search_terms').notNull().default(''),
    isVeg: boolean('is_veg').notNull().default(true),
    featured: boolean('featured').notNull().default(false),
    status: text('status').notNull().default('draft'),
    sort: integer('sort').notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('products_slug_uq').on(t.slug),
    index('products_category_idx').on(t.categoryId, t.status),
    index('products_search_idx').using('gin', sql`to_tsvector('simple', ${t.nameEn} || ' ' || ${t.nameHi} || ' ' || ${t.searchTerms})`),
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
    pricePaise: paise('price_paise').notNull(),
    mrpPaise: paise('mrp_paise').notNull(),
    weightGrams: integer('weight_grams').notNull(),
    hsnCode: text('hsn_code').notNull(),
    gstRateBps: integer('gst_rate_bps').notNull(),
    shelfLifeDays: integer('shelf_life_days').notNull(),
    storage: text('storage').notNull().default('ambient'),
    lowStockThreshold: integer('low_stock_threshold').notNull().default(20),
    maxPerOrder: integer('max_per_order').notNull().default(10),
    status: text('status').notNull().default('active'),
    sort: integer('sort').notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('variants_sku_uq').on(t.sku),
    index('variants_product_idx').on(t.productId),
    check('variants_price_ck', sql`${t.pricePaise} > 0 and ${t.pricePaise} <= ${t.mrpPaise}`),
    check('variants_storage_ck', sql`${t.storage} in ('ambient','cool_dry','chilled')`),
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
    width: integer('width'),
    height: integer('height'),
    variants: jsonb('variants').$type<ImageVariant[]>().notNull().default([]),
    altEn: text('alt_en').notNull().default(''),
    sort: integer('sort').notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index('product_media_product_idx').on(t.productId, t.sort)],
);

export interface ImageVariant {
  width: number;
  height: number;
  key: string;
}

/** Images used by storefront content (hero, story, banners), managed in admin. */
export const siteMedia = pgTable('site_media', {
  id: id(),
  key: text('key').notNull(),
  width: integer('width').notNull(),
  height: integer('height').notNull(),
  variants: jsonb('variants').$type<ImageVariant[]>().notNull().default([]),
  alt: text('alt').notNull().default(''),
  createdAt: createdAt(),
});

// ── Shipping ───────────────────────────────────────────────────────────────
export const shippingZones = pgTable(
  'shipping_zones',
  {
    code: text('code').primaryKey(),
    name: text('name').notNull(),
    pincodePrefixes: text('pincode_prefixes').array().notNull(),
    feePaise: paise('fee_paise').notNull(),
    freeAbovePaise: paise('free_above_paise'),
    includedGrams: integer('included_grams').notNull().default(2000),
    perExtraKgPaise: paise('per_extra_kg_paise').notNull().default(0),
    etaMinDays: integer('eta_min_days').notNull(),
    etaMaxDays: integer('eta_max_days').notNull(),
    serviceable: boolean('serviceable').notNull().default(true),
    sort: integer('sort').notNull().default(0),
    updatedAt: updatedAt(),
  },
  (t) => [check('shipping_eta_ck', sql`${t.etaMaxDays} >= ${t.etaMinDays}`)],
);

// ── Orders ─────────────────────────────────────────────────────────────────
export interface AddressSnapshot {
  name: string;
  phone: string;
  line1: string;
  line2: string | null;
  landmark: string | null;
  city: string;
  state: string;
  pincode: string;
  /** Door location at the time of ordering, if the customer shared it. */
  location?: { lat: number; lng: number; accuracyM: number | null; source: 'device' | 'map_pin' } | null;
}

export const orders = pgTable(
  'orders',
  {
    id: id(),
    number: text('number').notNull(),
    customerId: text('customer_id')
      .notNull()
      .references(() => customers.id),
    status: text('status').notNull(),
    subtotalPaise: paise('subtotal_paise').notNull(),
    shippingPaise: paise('shipping_paise').notNull(),
    discountPaise: paise('discount_paise').notNull().default(0),
    taxPaise: paise('tax_paise').notNull(),
    totalPaise: paise('total_paise').notNull(),
    shippingAddress: jsonb('shipping_address').$type<AddressSnapshot>().notNull(),
    couponCode: text('coupon_code'),
    shippingZone: text('shipping_zone').notNull(),
    etaMinDays: integer('eta_min_days').notNull(),
    etaMaxDays: integer('eta_max_days').notNull(),
    courier: text('courier'),
    trackingNumber: text('tracking_number'),
    trackingUrl: text('tracking_url'),
    note: text('note'),
    paidAt: ts('paid_at'),
    packedAt: ts('packed_at'),
    shippedAt: ts('shipped_at'),
    deliveredAt: ts('delivered_at'),
    cancelledAt: ts('cancelled_at'),
    cancelReason: text('cancel_reason'),
    expiresAt: ts('expires_at'),
    placedOn: bdate('placed_on').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('orders_number_uq').on(t.number),
    index('orders_customer_idx').on(t.customerId, t.createdAt),
    index('orders_status_idx').on(t.status, t.createdAt),
    index('orders_expiry_idx').on(t.expiresAt).where(sql`${t.status} = 'pending_payment'`),
    check('orders_status_ck', sql`${t.status} in ('pending_payment','confirmed','packed','shipped','delivered','cancelled','refunded')`),
    check('orders_total_ck', sql`${t.totalPaise} = ${t.subtotalPaise} + ${t.shippingPaise} - ${t.discountPaise}`),
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
    packSize: text('pack_size').notNull(),
    unitPricePaise: paise('unit_price_paise').notNull(),
    quantity: integer('quantity').notNull(),
    weightGrams: integer('weight_grams').notNull(),
    gstRateBps: integer('gst_rate_bps').notNull(),
    hsnCode: text('hsn_code').notNull(),
    lineTotalPaise: paise('line_total_paise').notNull(),
  },
  (t) => [index('order_items_order_idx').on(t.orderId), check('order_items_qty_ck', sql`${t.quantity} > 0`)],
);

/** Multi-vendor ready: one fulfilment unit per seller per order (exactly one today). */
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

/** Stock held for an order item, by batch (FEFO). */
export const orderAllocations = pgTable(
  'order_allocations',
  {
    orderItemId: text('order_item_id')
      .notNull()
      .references(() => orderItems.id),
    batchId: text('batch_id')
      .notNull()
      .references(() => batches.id),
    quantity: integer('quantity').notNull(),
    status: text('status').notNull().default('reserved'),
  },
  (t) => [
    primaryKey({ columns: [t.orderItemId, t.batchId] }),
    check('order_allocations_status_ck', sql`${t.status} in ('reserved','shipped','released')`),
  ],
);

export const counters = pgTable('counters', {
  key: text('key').primaryKey(),
  value: integer('value').notNull(),
});

// ── Payments ───────────────────────────────────────────────────────────────
export const payments = pgTable(
  'payments',
  {
    id: id(),
    orderId: text('order_id')
      .notNull()
      .references(() => orders.id),
    customerId: text('customer_id')
      .notNull()
      .references(() => customers.id),
    amountPaise: paise('amount_paise').notNull(),
    provider: text('provider').notNull(),
    providerOrderId: text('provider_order_id').notNull(),
    providerPaymentId: text('provider_payment_id'),
    paymentSessionId: text('payment_session_id'),
    method: text('method'),
    status: text('status').notNull().default('created'),
    raw: jsonb('raw'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('payments_provider_order_uq').on(t.provider, t.providerOrderId),
    index('payments_order_idx').on(t.orderId),
    index('payments_status_idx').on(t.status, t.createdAt),
    check('payments_status_ck', sql`${t.status} in ('created','success','failed','user_dropped','expired','refunded')`),
    check('payments_provider_ck', sql`${t.provider} in ('cashfree','mock')`),
  ],
);

export const refunds = pgTable(
  'refunds',
  {
    id: id(),
    orderId: text('order_id')
      .notNull()
      .references(() => orders.id),
    paymentId: text('payment_id')
      .notNull()
      .references(() => payments.id),
    amountPaise: paise('amount_paise').notNull(),
    status: text('status').notNull().default('pending'),
    providerRefundId: text('provider_refund_id'),
    reason: text('reason').notNull(),
    createdByType: text('created_by_type').notNull(),
    createdById: text('created_by_id'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('refunds_order_idx').on(t.orderId),
    check('refunds_status_ck', sql`${t.status} in ('pending','success','failed')`),
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
    check('batches_dates_ck', sql`${t.expiresOn} > ${t.manufacturedOn}`),
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
  (t) => [
    index('stock_movements_batch_idx').on(t.batchId, t.createdAt),
    check('stock_movements_kind_ck', sql`${t.kind} in ('produced','reserved','released','shipped','adjusted','wasted','returned')`),
  ],
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
    /** One queued message per event, e.g. "order:ord_…:ship", so retries never double-send. */
    dedupeKey: text('dedupe_key'),
    attempts: integer('attempts').notNull().default(0),
    lastError: text('last_error'),
    sentAt: ts('sent_at'),
    readAt: ts('read_at'),
    createdAt: createdAt(),
  },
  (t) => [
    index('notifications_customer_idx').on(t.customerId, t.createdAt),
    uniqueIndex('notifications_dedupe_uq').on(t.dedupeKey),
    index('notifications_pending_idx').on(t.status, t.createdAt).where(sql`${t.status} = 'pending'`),
  ],
);

/** Verified reviews: only customers with a delivered order for the product can write one; staff approve before it shows. */
export const productReviews = pgTable(
  'product_reviews',
  {
    id: id(),
    productId: text('product_id')
      .notNull()
      .references(() => products.id),
    customerId: text('customer_id')
      .notNull()
      .references(() => customers.id),
    orderId: text('order_id')
      .notNull()
      .references(() => orders.id),
    rating: integer('rating').notNull(),
    title: text('title').notNull().default(''),
    body: text('body').notNull().default(''),
    authorName: text('author_name').notNull(),
    status: text('status').notNull().default('pending'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('product_reviews_one_per_customer_uq').on(t.productId, t.customerId),
    index('product_reviews_product_idx').on(t.productId, t.status, t.createdAt),
    check('product_reviews_rating_ck', sql`${t.rating} between 1 and 5`),
    check('product_reviews_status_ck', sql`${t.status} in ('pending','approved','rejected')`),
  ],
);

/** Discount codes managed in the admin. A code takes a percentage (with an optional cap) or a fixed amount off the products. */
export const coupons = pgTable(
  'coupons',
  {
    id: id(),
    sellerId: text('seller_id')
      .notNull()
      .references(() => sellers.id),
    code: text('code').notNull(),
    description: text('description').notNull().default(''),
    kind: text('kind').notNull(),
    percentBps: integer('percent_bps'),
    amountPaise: paise('amount_paise'),
    maxDiscountPaise: paise('max_discount_paise'),
    minSubtotalPaise: paise('min_subtotal_paise').notNull().default(0),
    startsAt: ts('starts_at'),
    endsAt: ts('ends_at'),
    /** Total uses across all customers (orders that were not cancelled). Null = unlimited. */
    usageLimit: integer('usage_limit'),
    perCustomerLimit: integer('per_customer_limit').notNull().default(1),
    firstOrderOnly: boolean('first_order_only').notNull().default(false),
    status: text('status').notNull().default('active'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('coupons_code_uq').on(t.sellerId, t.code),
    check('coupons_kind_ck', sql`(${t.kind} = 'percent' and ${t.percentBps} between 1 and 10000 and ${t.amountPaise} is null) or (${t.kind} = 'fixed' and ${t.amountPaise} > 0 and ${t.percentBps} is null)`),
    check('coupons_status_ck', sql`${t.status} in ('active','paused')`),
  ],
);

export const couponRedemptions = pgTable(
  'coupon_redemptions',
  {
    id: id(),
    couponId: text('coupon_id')
      .notNull()
      .references(() => coupons.id),
    customerId: text('customer_id')
      .notNull()
      .references(() => customers.id),
    orderId: text('order_id')
      .notNull()
      .references(() => orders.id),
    amountPaise: paise('amount_paise').notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('coupon_redemptions_order_uq').on(t.orderId), index('coupon_redemptions_coupon_idx').on(t.couponId, t.customerId)],
);
