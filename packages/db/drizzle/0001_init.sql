CREATE TABLE "addresses" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"label" text,
	"line1" text NOT NULL,
	"line2" text,
	"landmark" text,
	"society" text,
	"city" text NOT NULL,
	"state" text NOT NULL,
	"pincode" text NOT NULL,
	"location" geography(Point, 4326),
	"zone_id" text,
	"delivery_instructions" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agents" (
	"id" text PRIMARY KEY NOT NULL,
	"seller_id" text NOT NULL,
	"email" text NOT NULL,
	"google_sub" text,
	"name" text NOT NULL,
	"phone" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"actor_type" text NOT NULL,
	"actor_id" text,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"ip_prefix" text,
	"request_id" text,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_identities" (
	"id" text PRIMARY KEY NOT NULL,
	"user_type" text NOT NULL,
	"user_id" text NOT NULL,
	"provider" text NOT NULL,
	"subject" text NOT NULL,
	"email" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "batches" (
	"id" text PRIMARY KEY NOT NULL,
	"variant_id" text NOT NULL,
	"seller_id" text NOT NULL,
	"code" text NOT NULL,
	"manufactured_on" date NOT NULL,
	"expires_on" date NOT NULL,
	"quantity_produced" integer NOT NULL,
	"on_hand" integer NOT NULL,
	"reserved" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "batches_qty_ck" CHECK ("batches"."on_hand" >= 0 and "batches"."reserved" >= 0 and "batches"."reserved" <= "batches"."on_hand")
);
--> statement-breakpoint
CREATE TABLE "carts" (
	"customer_id" text PRIMARY KEY NOT NULL,
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"coupon_code" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" text PRIMARY KEY NOT NULL,
	"parent_id" text,
	"slug" text NOT NULL,
	"name_en" text NOT NULL,
	"name_hi" text NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"language" text DEFAULT 'en' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"default_address_id" text,
	"referral_code" text NOT NULL,
	"referred_by" text,
	"deletion_requested_at" timestamp with time zone,
	"notification_prefs" jsonb DEFAULT '{"marketingPush":false,"marketingEmail":false,"cutoffReminder":false,"deliveredPush":true}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customers_language_ck" CHECK ("customers"."language" in ('en','hi')),
	CONSTRAINT "customers_status_ck" CHECK ("customers"."status" in ('active','deletion_requested','deleted'))
);
--> statement-breakpoint
CREATE TABLE "cutoff_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"seller_id" text NOT NULL,
	"delivery_date" date NOT NULL,
	"slot_id" text NOT NULL,
	"status" text NOT NULL,
	"stats" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "deliveries" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"seller_id" text NOT NULL,
	"address_id" text NOT NULL,
	"delivery_date" date NOT NULL,
	"slot_id" text NOT NULL,
	"run_id" text,
	"stop_sequence" integer,
	"status" text NOT NULL,
	"charge_paise" bigint DEFAULT 0 NOT NULL,
	"charged_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "deliveries_status_ck" CHECK ("deliveries"."status" in ('scheduled','packed','out_for_delivery','delivered','not_available','refused','missed','skipped_low_balance','cancelled'))
);
--> statement-breakpoint
CREATE TABLE "delivery_allocations" (
	"delivery_item_id" text NOT NULL,
	"batch_id" text NOT NULL,
	"quantity" integer NOT NULL,
	CONSTRAINT "delivery_allocations_delivery_item_id_batch_id_pk" PRIMARY KEY("delivery_item_id","batch_id")
);
--> statement-breakpoint
CREATE TABLE "delivery_events" (
	"id" text PRIMARY KEY NOT NULL,
	"delivery_id" text NOT NULL,
	"type" text NOT NULL,
	"actor_type" text NOT NULL,
	"actor_id" text,
	"client_event_id" text,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "delivery_items" (
	"id" text PRIMARY KEY NOT NULL,
	"delivery_id" text NOT NULL,
	"variant_id" text NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price_paise" bigint NOT NULL,
	"source" text NOT NULL,
	"subscription_id" text,
	"order_id" text
);
--> statement-breakpoint
CREATE TABLE "delivery_slots" (
	"id" text PRIMARY KEY NOT NULL,
	"seller_id" text NOT NULL,
	"code" text NOT NULL,
	"label_en" text NOT NULL,
	"label_hi" text NOT NULL,
	"starts_at" time NOT NULL,
	"ends_at" time NOT NULL,
	"cutoff_offset_minutes" integer NOT NULL,
	"days_of_week" smallint[] DEFAULT '{0,1,2,3,4,5,6}' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "delivery_zones" (
	"id" text PRIMARY KEY NOT NULL,
	"seller_id" text NOT NULL,
	"name" text NOT NULL,
	"area" geography(MultiPolygon, 4326),
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "devices" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"platform" text NOT NULL,
	"push_token" text NOT NULL,
	"app_version" text,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "holidays" (
	"id" text PRIMARY KEY NOT NULL,
	"seller_id" text NOT NULL,
	"date" date NOT NULL,
	"slot_id" text,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "idempotency_keys" (
	"key" text NOT NULL,
	"user_id" text NOT NULL,
	"route" text NOT NULL,
	"request_hash" text NOT NULL,
	"response_status" integer,
	"response_body" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "idempotency_keys_user_id_key_pk" PRIMARY KEY("user_id","key")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"channel" text NOT NULL,
	"template" text NOT NULL,
	"title" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"link" text,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"sent_at" timestamp with time zone,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_events" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"type" text NOT NULL,
	"from_status" text,
	"to_status" text,
	"actor_type" text NOT NULL,
	"actor_id" text,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"variant_id" text NOT NULL,
	"seller_id" text NOT NULL,
	"name_snapshot" text NOT NULL,
	"sku_snapshot" text NOT NULL,
	"unit_price_paise" bigint NOT NULL,
	"quantity" integer NOT NULL,
	"gst_rate_bps" integer NOT NULL,
	"hsn_code" text NOT NULL,
	"line_total_paise" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" text PRIMARY KEY NOT NULL,
	"number" text NOT NULL,
	"customer_id" text NOT NULL,
	"address_id" text NOT NULL,
	"slot_id" text NOT NULL,
	"delivery_date" date NOT NULL,
	"status" text NOT NULL,
	"payment_method" text NOT NULL,
	"subtotal_paise" bigint NOT NULL,
	"discount_paise" bigint DEFAULT 0 NOT NULL,
	"deposit_paise" bigint DEFAULT 0 NOT NULL,
	"total_paise" bigint NOT NULL,
	"coupon_code" text,
	"payment_id" text,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_status_ck" CHECK ("orders"."status" in ('pending_payment','confirmed','scheduled','out_for_delivery','delivered','failed','cancelled','refunded')),
	CONSTRAINT "orders_payment_method_ck" CHECK ("orders"."payment_method" in ('wallet','online'))
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"purpose" text NOT NULL,
	"amount_paise" bigint NOT NULL,
	"provider" text DEFAULT 'cashfree' NOT NULL,
	"provider_order_id" text,
	"provider_payment_id" text,
	"payment_session_id" text,
	"method" text,
	"status" text DEFAULT 'created' NOT NULL,
	"raw" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_purpose_ck" CHECK ("payments"."purpose" in ('topup','order')),
	CONSTRAINT "payments_status_ck" CHECK ("payments"."status" in ('created','pending','success','failed','user_dropped','expired','refunded'))
);
--> statement-breakpoint
CREATE TABLE "product_media" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"kind" text NOT NULL,
	"r2_key" text NOT NULL,
	"sizes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"width" integer,
	"height" integer,
	"alt_en" text DEFAULT '' NOT NULL,
	"alt_hi" text DEFAULT '' NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_variants" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"seller_id" text NOT NULL,
	"sku" text NOT NULL,
	"pack_size" text NOT NULL,
	"unit" text NOT NULL,
	"unit_quantity" integer NOT NULL,
	"price_paise" bigint NOT NULL,
	"mrp_paise" bigint NOT NULL,
	"subscription_price_paise" bigint,
	"hsn_code" text NOT NULL,
	"gst_rate_bps" integer NOT NULL,
	"shelf_life_days" integer NOT NULL,
	"storage" text DEFAULT 'chilled' NOT NULL,
	"packaging" text DEFAULT 'pouch' NOT NULL,
	"bottle_deposit_paise" bigint DEFAULT 0 NOT NULL,
	"subscribable" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "variants_price_ck" CHECK ("product_variants"."price_paise" > 0 and "product_variants"."price_paise" <= "product_variants"."mrp_paise"),
	CONSTRAINT "variants_unit_ck" CHECK ("product_variants"."unit" in ('ml','g','pcs')),
	CONSTRAINT "variants_storage_ck" CHECK ("product_variants"."storage" in ('chilled','frozen','ambient')),
	CONSTRAINT "variants_packaging_ck" CHECK ("product_variants"."packaging" in ('pouch','bottle','tub','box')),
	CONSTRAINT "variants_status_ck" CHECK ("product_variants"."status" in ('active','archived'))
);
--> statement-breakpoint
CREATE TABLE "production_plans" (
	"id" text PRIMARY KEY NOT NULL,
	"seller_id" text NOT NULL,
	"delivery_date" date NOT NULL,
	"slot_id" text NOT NULL,
	"lines" jsonb NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" text PRIMARY KEY NOT NULL,
	"seller_id" text NOT NULL,
	"category_id" text NOT NULL,
	"slug" text NOT NULL,
	"name_en" text NOT NULL,
	"name_hi" text NOT NULL,
	"description_en" text DEFAULT '' NOT NULL,
	"description_hi" text DEFAULT '' NOT NULL,
	"attributes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"nutrition" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"search_terms" text DEFAULT '' NOT NULL,
	"is_veg" boolean DEFAULT true NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_status_ck" CHECK ("products"."status" in ('draft','active','archived'))
);
--> statement-breakpoint
CREATE TABLE "route_stops" (
	"route_id" text NOT NULL,
	"address_id" text NOT NULL,
	"sequence" integer NOT NULL,
	CONSTRAINT "route_stops_route_id_address_id_pk" PRIMARY KEY("route_id","address_id")
);
--> statement-breakpoint
CREATE TABLE "routes" (
	"id" text PRIMARY KEY NOT NULL,
	"zone_id" text NOT NULL,
	"name" text NOT NULL,
	"default_agent_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "runs" (
	"id" text PRIMARY KEY NOT NULL,
	"route_id" text NOT NULL,
	"agent_id" text,
	"delivery_date" date NOT NULL,
	"slot_id" text NOT NULL,
	"status" text DEFAULT 'planned' NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seller_orders" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"seller_id" text NOT NULL,
	"status" text NOT NULL,
	"subtotal_paise" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sellers" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"legal_name" text NOT NULL,
	"gstin" text,
	"fssai_number" text,
	"state_code" text DEFAULT '27' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_type" text NOT NULL,
	"user_id" text NOT NULL,
	"client" text NOT NULL,
	"refresh_token_hash" text NOT NULL,
	"previous_token_hash" text,
	"device_name" text,
	"user_agent" text,
	"ip_prefix" text,
	"mfa_pending" boolean DEFAULT false NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_used_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_client_ck" CHECK ("sessions"."client" in ('web','admin','agent','android'))
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"seller_id" text NOT NULL,
	"key" text NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "settings_seller_id_key_pk" PRIMARY KEY("seller_id","key")
);
--> statement-breakpoint
CREATE TABLE "staff" (
	"id" text PRIMARY KEY NOT NULL,
	"seller_id" text,
	"email" text NOT NULL,
	"google_sub" text,
	"name" text NOT NULL,
	"role" text NOT NULL,
	"totp_secret_enc" text,
	"totp_enabled_at" timestamp with time zone,
	"status" text DEFAULT 'active' NOT NULL,
	"last_sign_in_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "staff_role_ck" CHECK ("staff"."role" in ('owner','admin','ops_manager','dispatch','support','content','accountant')),
	CONSTRAINT "staff_status_ck" CHECK ("staff"."status" in ('active','deactivated'))
);
--> statement-breakpoint
CREATE TABLE "stock_movements" (
	"id" text PRIMARY KEY NOT NULL,
	"batch_id" text NOT NULL,
	"kind" text NOT NULL,
	"quantity" integer NOT NULL,
	"reference_type" text,
	"reference_id" text,
	"reason" text,
	"created_by_type" text DEFAULT 'system' NOT NULL,
	"created_by_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription_items" (
	"id" text PRIMARY KEY NOT NULL,
	"subscription_id" text NOT NULL,
	"variant_id" text NOT NULL,
	"quantity" integer,
	"weekday_quantities" smallint[]
);
--> statement-breakpoint
CREATE TABLE "subscription_overrides" (
	"subscription_id" text NOT NULL,
	"date" date NOT NULL,
	"items" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscription_overrides_subscription_id_date_pk" PRIMARY KEY("subscription_id","date")
);
--> statement-breakpoint
CREATE TABLE "subscription_pauses" (
	"id" text PRIMARY KEY NOT NULL,
	"subscription_id" text NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"created_by_type" text DEFAULT 'customer' NOT NULL,
	"created_by_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscription_pauses_range_ck" CHECK ("subscription_pauses"."ends_on" >= "subscription_pauses"."starts_on")
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"seller_id" text NOT NULL,
	"address_id" text NOT NULL,
	"slot_id" text NOT NULL,
	"pattern" text NOT NULL,
	"anchor_date" date NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date,
	"status" text DEFAULT 'active' NOT NULL,
	"cancel_reason" text,
	"cancel_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_pattern_ck" CHECK ("subscriptions"."pattern" in ('daily','alternate','weekdays')),
	CONSTRAINT "subscriptions_status_ck" CHECK ("subscriptions"."status" in ('active','cancelled'))
);
--> statement-breakpoint
CREATE TABLE "topups" (
	"id" text PRIMARY KEY NOT NULL,
	"wallet_id" text NOT NULL,
	"amount_paise" bigint NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"payment_id" text,
	"source" text DEFAULT 'manual' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "topups_status_ck" CHECK ("topups"."status" in ('pending','paid','failed','expired'))
);
--> statement-breakpoint
CREATE TABLE "wallet_ledger" (
	"id" text PRIMARY KEY NOT NULL,
	"wallet_id" text NOT NULL,
	"entry_group_id" text NOT NULL,
	"account" text NOT NULL,
	"amount_paise" bigint NOT NULL,
	"balance_after_paise" bigint,
	"kind" text NOT NULL,
	"reference_type" text NOT NULL,
	"reference_id" text NOT NULL,
	"memo" text DEFAULT '' NOT NULL,
	"created_by_type" text DEFAULT 'system' NOT NULL,
	"created_by_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wallets" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"balance_paise" bigint DEFAULT 0 NOT NULL,
	"overdraft_limit_paise" bigint DEFAULT 0 NOT NULL,
	"low_balance_threshold_paise" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" text PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"event_key" text NOT NULL,
	"type" text NOT NULL,
	"signature_valid" boolean NOT NULL,
	"payload" jsonb NOT NULL,
	"processed_at" timestamp with time zone,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zone_availability" (
	"variant_id" text NOT NULL,
	"zone_id" text NOT NULL,
	"available" boolean DEFAULT true NOT NULL,
	"max_per_day" integer,
	CONSTRAINT "zone_availability_variant_id_zone_id_pk" PRIMARY KEY("variant_id","zone_id")
);
--> statement-breakpoint
CREATE TABLE "zone_pincodes" (
	"zone_id" text NOT NULL,
	"pincode" text NOT NULL,
	CONSTRAINT "zone_pincodes_zone_id_pincode_pk" PRIMARY KEY("zone_id","pincode")
);
--> statement-breakpoint
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_zone_id_delivery_zones_id_fk" FOREIGN KEY ("zone_id") REFERENCES "public"."delivery_zones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batches" ADD CONSTRAINT "batches_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batches" ADD CONSTRAINT "batches_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carts" ADD CONSTRAINT "carts_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cutoff_runs" ADD CONSTRAINT "cutoff_runs_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cutoff_runs" ADD CONSTRAINT "cutoff_runs_slot_id_delivery_slots_id_fk" FOREIGN KEY ("slot_id") REFERENCES "public"."delivery_slots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_address_id_addresses_id_fk" FOREIGN KEY ("address_id") REFERENCES "public"."addresses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_slot_id_delivery_slots_id_fk" FOREIGN KEY ("slot_id") REFERENCES "public"."delivery_slots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_allocations" ADD CONSTRAINT "delivery_allocations_delivery_item_id_delivery_items_id_fk" FOREIGN KEY ("delivery_item_id") REFERENCES "public"."delivery_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_allocations" ADD CONSTRAINT "delivery_allocations_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_events" ADD CONSTRAINT "delivery_events_delivery_id_deliveries_id_fk" FOREIGN KEY ("delivery_id") REFERENCES "public"."deliveries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_items" ADD CONSTRAINT "delivery_items_delivery_id_deliveries_id_fk" FOREIGN KEY ("delivery_id") REFERENCES "public"."deliveries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_items" ADD CONSTRAINT "delivery_items_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_items" ADD CONSTRAINT "delivery_items_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_items" ADD CONSTRAINT "delivery_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_slots" ADD CONSTRAINT "delivery_slots_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_zones" ADD CONSTRAINT "delivery_zones_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holidays" ADD CONSTRAINT "holidays_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holidays" ADD CONSTRAINT "holidays_slot_id_delivery_slots_id_fk" FOREIGN KEY ("slot_id") REFERENCES "public"."delivery_slots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_events" ADD CONSTRAINT "order_events_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_address_id_addresses_id_fk" FOREIGN KEY ("address_id") REFERENCES "public"."addresses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_slot_id_delivery_slots_id_fk" FOREIGN KEY ("slot_id") REFERENCES "public"."delivery_slots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_media" ADD CONSTRAINT "product_media_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_plans" ADD CONSTRAINT "production_plans_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_plans" ADD CONSTRAINT "production_plans_slot_id_delivery_slots_id_fk" FOREIGN KEY ("slot_id") REFERENCES "public"."delivery_slots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_stops" ADD CONSTRAINT "route_stops_route_id_routes_id_fk" FOREIGN KEY ("route_id") REFERENCES "public"."routes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_stops" ADD CONSTRAINT "route_stops_address_id_addresses_id_fk" FOREIGN KEY ("address_id") REFERENCES "public"."addresses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routes" ADD CONSTRAINT "routes_zone_id_delivery_zones_id_fk" FOREIGN KEY ("zone_id") REFERENCES "public"."delivery_zones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routes" ADD CONSTRAINT "routes_default_agent_id_agents_id_fk" FOREIGN KEY ("default_agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_route_id_routes_id_fk" FOREIGN KEY ("route_id") REFERENCES "public"."routes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_slot_id_delivery_slots_id_fk" FOREIGN KEY ("slot_id") REFERENCES "public"."delivery_slots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_orders" ADD CONSTRAINT "seller_orders_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_orders" ADD CONSTRAINT "seller_orders_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff" ADD CONSTRAINT "staff_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_items" ADD CONSTRAINT "subscription_items_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_items" ADD CONSTRAINT "subscription_items_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_overrides" ADD CONSTRAINT "subscription_overrides_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_pauses" ADD CONSTRAINT "subscription_pauses_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_address_id_addresses_id_fk" FOREIGN KEY ("address_id") REFERENCES "public"."addresses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_slot_id_delivery_slots_id_fk" FOREIGN KEY ("slot_id") REFERENCES "public"."delivery_slots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topups" ADD CONSTRAINT "topups_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topups" ADD CONSTRAINT "topups_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_ledger" ADD CONSTRAINT "wallet_ledger_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zone_availability" ADD CONSTRAINT "zone_availability_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zone_availability" ADD CONSTRAINT "zone_availability_zone_id_delivery_zones_id_fk" FOREIGN KEY ("zone_id") REFERENCES "public"."delivery_zones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zone_pincodes" ADD CONSTRAINT "zone_pincodes_zone_id_delivery_zones_id_fk" FOREIGN KEY ("zone_id") REFERENCES "public"."delivery_zones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "addresses_customer_idx" ON "addresses" USING btree ("customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "agents_email_uq" ON "agents" USING btree (lower("email"));--> statement-breakpoint
CREATE UNIQUE INDEX "agents_google_sub_uq" ON "agents" USING btree ("google_sub");--> statement-breakpoint
CREATE INDEX "audit_entity_idx" ON "audit_log" USING btree ("entity_type","entity_id","at");--> statement-breakpoint
CREATE INDEX "audit_actor_idx" ON "audit_log" USING btree ("actor_id","at");--> statement-breakpoint
CREATE UNIQUE INDEX "auth_identities_subject_uq" ON "auth_identities" USING btree ("provider","subject","user_type");--> statement-breakpoint
CREATE INDEX "auth_identities_user_idx" ON "auth_identities" USING btree ("user_type","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "batches_code_uq" ON "batches" USING btree ("seller_id","code");--> statement-breakpoint
CREATE INDEX "batches_fefo_idx" ON "batches" USING btree ("variant_id","expires_on") WHERE "batches"."status" = 'active';--> statement-breakpoint
CREATE UNIQUE INDEX "categories_slug_uq" ON "categories" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "customers_referral_code_uq" ON "customers" USING btree ("referral_code");--> statement-breakpoint
CREATE INDEX "customers_email_idx" ON "customers" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "customers_phone_idx" ON "customers" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "cutoff_runs_date_idx" ON "cutoff_runs" USING btree ("delivery_date","slot_id");--> statement-breakpoint
CREATE UNIQUE INDEX "deliveries_uq" ON "deliveries" USING btree ("customer_id","address_id","delivery_date","slot_id");--> statement-breakpoint
CREATE INDEX "deliveries_dispatch_idx" ON "deliveries" USING btree ("delivery_date","slot_id","run_id","stop_sequence");--> statement-breakpoint
CREATE INDEX "deliveries_customer_idx" ON "deliveries" USING btree ("customer_id","delivery_date");--> statement-breakpoint
CREATE UNIQUE INDEX "delivery_events_client_uq" ON "delivery_events" USING btree ("client_event_id");--> statement-breakpoint
CREATE INDEX "delivery_events_delivery_idx" ON "delivery_events" USING btree ("delivery_id","occurred_at");--> statement-breakpoint
CREATE INDEX "delivery_items_delivery_idx" ON "delivery_items" USING btree ("delivery_id");--> statement-breakpoint
CREATE UNIQUE INDEX "slots_seller_code_uq" ON "delivery_slots" USING btree ("seller_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "devices_token_uq" ON "devices" USING btree ("push_token");--> statement-breakpoint
CREATE INDEX "holidays_date_idx" ON "holidays" USING btree ("seller_id","date");--> statement-breakpoint
CREATE INDEX "notifications_customer_idx" ON "notifications" USING btree ("customer_id","created_at");--> statement-breakpoint
CREATE INDEX "order_events_order_idx" ON "order_events" USING btree ("order_id","at");--> statement-breakpoint
CREATE INDEX "order_items_order_idx" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_number_uq" ON "orders" USING btree ("number");--> statement-breakpoint
CREATE INDEX "orders_customer_idx" ON "orders" USING btree ("customer_id","created_at");--> statement-breakpoint
CREATE INDEX "orders_delivery_idx" ON "orders" USING btree ("delivery_date","slot_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_provider_order_uq" ON "payments" USING btree ("provider_order_id");--> statement-breakpoint
CREATE INDEX "payments_status_idx" ON "payments" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "product_media_product_idx" ON "product_media" USING btree ("product_id","sort");--> statement-breakpoint
CREATE UNIQUE INDEX "variants_sku_uq" ON "product_variants" USING btree ("sku");--> statement-breakpoint
CREATE INDEX "variants_product_idx" ON "product_variants" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "production_plans_uq" ON "production_plans" USING btree ("seller_id","delivery_date","slot_id");--> statement-breakpoint
CREATE UNIQUE INDEX "products_slug_uq" ON "products" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "products_category_idx" ON "products" USING btree ("category_id","status");--> statement-breakpoint
CREATE INDEX "products_search_idx" ON "products" USING gin (to_tsvector('simple', "name_en" || ' ' || "name_hi" || ' ' || "search_terms"));--> statement-breakpoint
CREATE INDEX "products_name_trgm_idx" ON "products" USING gin ("name_en" gin_trgm_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "route_stops_address_uq" ON "route_stops" USING btree ("address_id");--> statement-breakpoint
CREATE UNIQUE INDEX "runs_route_date_uq" ON "runs" USING btree ("route_id","delivery_date","slot_id");--> statement-breakpoint
CREATE UNIQUE INDEX "seller_orders_uq" ON "seller_orders" USING btree ("order_id","seller_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_refresh_uq" ON "sessions" USING btree ("refresh_token_hash");--> statement-breakpoint
CREATE INDEX "sessions_previous_idx" ON "sessions" USING btree ("previous_token_hash");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_type","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "staff_email_uq" ON "staff" USING btree (lower("email"));--> statement-breakpoint
CREATE UNIQUE INDEX "staff_google_sub_uq" ON "staff" USING btree ("google_sub");--> statement-breakpoint
CREATE INDEX "stock_movements_batch_idx" ON "stock_movements" USING btree ("batch_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "subscription_items_uq" ON "subscription_items" USING btree ("subscription_id","variant_id");--> statement-breakpoint
CREATE INDEX "subscription_pauses_idx" ON "subscription_pauses" USING btree ("subscription_id","starts_on","ends_on");--> statement-breakpoint
CREATE INDEX "subscriptions_customer_idx" ON "subscriptions" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "subscriptions_active_idx" ON "subscriptions" USING btree ("slot_id") WHERE "subscriptions"."status" = 'active';--> statement-breakpoint
CREATE INDEX "topups_wallet_idx" ON "topups" USING btree ("wallet_id","created_at");--> statement-breakpoint
CREATE INDEX "wallet_ledger_wallet_idx" ON "wallet_ledger" USING btree ("wallet_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "wallet_ledger_once_uq" ON "wallet_ledger" USING btree ("kind","reference_type","reference_id") WHERE "wallet_ledger"."account" = 'customer';--> statement-breakpoint
CREATE INDEX "wallet_ledger_group_idx" ON "wallet_ledger" USING btree ("entry_group_id");--> statement-breakpoint
CREATE UNIQUE INDEX "wallets_customer_uq" ON "wallets" USING btree ("customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "webhook_events_key_uq" ON "webhook_events" USING btree ("provider","event_key");--> statement-breakpoint
CREATE INDEX "zone_pincodes_pincode_idx" ON "zone_pincodes" USING btree ("pincode");