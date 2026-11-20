# 05 · Data model

PostgreSQL 16+ with `pg_trgm`. Schema in `packages/db/src/schema.ts` (Drizzle); migrations are SQL files in `packages/db/drizzle/`.

## Conventions

| Rule | Detail |
|---|---|
| IDs | `text` with a type prefix and a sortable 26-character body: `ord_01JD…`, `var_01JD…` |
| Money | `bigint` paise, columns end in `_paise` |
| Timestamps | `timestamptz` in UTC; business dates are `date` in IST (`placed_on`, `expires_on`) |
| History | `stock_movements`, `order_events`, `audit_log` are append-only for the app role; payments, refunds and orders can't be deleted |
| Seller scope | `seller_id` on products, variants, batches, order items and seller orders (one seller today) |

## Tables

| Group | Table | Purpose / key columns |
|---|---|---|
| People | `sellers` | Legal name, GSTIN, FSSAI, state |
| | `staff` | Email, bound `google_sub`, role, status, `invited_by` |
| | `customers` | Name, email, phone, language, default address, deletion status, notification prefs |
| | `auth_identities` | (provider, subject, user type) → user. Provider `google`, or `dev` for test sign-in |
| | `sessions` | Refresh token hash + previous hash (reuse detection), client, device, expiry, revoked |
| | `addresses` | Recipient name and phone, lines, city, state (from pincode), pincode |
| | `devices` | Push tokens (web/Android) |
| Catalog | `categories` | Slug, English/Hindi name, blurb |
| | `products` | Names, tagline, description, attributes (animal, fat %, process, ingredients), nutrition, **`pack`** visual (kind, colour, accent), search terms, featured, status |
| | `product_variants` | SKU, pack size, price, MRP, weight, HSN, GST rate, shelf life, storage, reorder level, max per order |
| | `product_media` | Photos in R2 (when photography exists) |
| Shipping | `shipping_zones` | Pincode prefixes, fee, free-above, included grams, per-extra-kg fee, ETA days, serviceable |
| Orders | `orders` | Number, status, subtotal/shipping/discount/tax/total (checked: total = subtotal + shipping − discount), address snapshot, zone, ETA, courier, AWB, timestamps per state, cancel reason, payment window `expires_at`, `placed_on` |
| | `order_items` | Name/SKU/size/price/GST/HSN snapshot, quantity, weight |
| | `seller_orders` | One per seller per order (fulfilment unit, multi-vendor ready) |
| | `order_events` | Every transition with actor and data |
| | `order_allocations` | Order item × batch × quantity, status `reserved` / `shipped` / `released` |
| | `counters` | Daily order number sequence |
| Payments | `payments` | Provider (`cashfree`/`mock`), provider order ID (= our payment ID), session ID, provider payment ID, method, status |
| | `refunds` | Amount, reason, provider refund ID, status, who issued it |
| | `webhook_events` | Deduplicated raw events (unique per provider + event key) |
| Inventory | `batches` | Variant, code, manufactured/expires, produced, on hand, reserved (checked: 0 ≤ reserved ≤ on hand) |
| | `stock_movements` | Ledger of every stock change with reference and reason |
| Platform | `settings` | Per-seller key/value (payment window, support contacts) |
| | `audit_log` | Staff actions with before/after JSON |
| | `idempotency_keys` | Stored responses for retried requests (24 h) |
| | `notifications` | In-app/email/push notifications (sending is a next step) |

## Key indexes

`orders (status, created_at)`, `orders (customer_id, created_at)`, partial `orders (expires_at) where status = 'pending_payment'` for the expiry job, `batches (variant_id, expires_on) where active` for FEFO, GIN full-text and trigram indexes on product names and search terms, unique `payments (provider, provider_order_id)`.
