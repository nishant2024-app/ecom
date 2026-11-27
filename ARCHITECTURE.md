# Architecture

How the shop is built, why, and where to look when you change something. Deeper write-ups per topic are linked from [docs/README.md](docs/README.md).

## What this is

An online shop for shelf-stable dairy (ghee, milk powder, UHT and flavoured milk, condensed milk, mithai) shipped by courier across India. One brand today, designed to allow several sellers later. Customers sign in with Google only and pay in INR with Cashfree (prepaid, no cash on delivery). The same API will serve an Android app later.

## The parts

```
                         ┌──────────────────────┐
  Customers ───────────▶ │  Shop  (apps/web)    │  Next.js, server-rendered, SEO
                         │  port 3000           │
                         └─────────┬────────────┘
                                   │ /api/* is forwarded      ┌────────────────────────┐
  Browser (shop) ─────────────────▶│                          │ Admin (apps/admin)     │
                                   ▼                          │ static React app       │
                         ┌──────────────────────┐ ◀───────────│ staff sign in (Google) │
  Android app (later) ─▶ │  API  (apps/api)     │             └────────────────────────┘
  Cashfree webhooks ───▶ │  Fastify, port 4000  │
                         └───┬────────┬─────────┘
                             │        │
                  ┌──────────▼──┐  ┌──▼────────┐      ┌──────────────────────┐
                  │ PostgreSQL  │  │ Valkey    │      │ Worker (same image)  │
                  │ all data    │  │ rate      │      │ every minute: expire │
                  └──────▲──────┘  │ limits,   │      │ unpaid orders, send  │
                         │         │ caches    │      │ queued emails        │
                         └─────────┴───────────┘◀─────┴──────────────────────┘

  Outside services: Google (sign-in) · Cashfree (payments) · Cloudflare R2 (photos, optional) ·
  Resend or Brevo (email, optional) · OpenStreetMap / Nominatim (map and address lookup)
```

| Part   | Folder                   | Technology                                                        | Role                                                                                                                 |
| ------ | ------------------------ | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| API    | `apps/api`               | Fastify 5, TypeBox, Drizzle, jose                                 | All business operations. The only thing that talks to the database                                                   |
| Worker | `apps/api/src/worker.ts` | same image as the API                                             | Every minute: expires unpaid orders (after asking Cashfree whether they were paid after all) and sends queued emails |
| Shop   | `apps/web`               | Next.js 15 (App Router, standalone), Tailwind v4, Motion, Leaflet | Storefront, checkout, customer account                                                                               |
| Admin  | `apps/admin`             | Vite, React, Tailwind                                             | Products, photos, stock, orders, coupons, reviews, storefront content, people                                        |
| Video  | `apps/video`             | Remotion                                                          | Optional: renders promo videos from the same illustrations. Not part of the running site                             |
| Core   | `packages/core`          | TypeScript, no I/O                                                | Pure business rules: money, IST dates, ids, shipping zones, order states, GST, FEFO stock, coupons, geo              |
| DB     | `packages/db`            | Drizzle, postgres.js                                              | Schema, SQL migrations (`drizzle/`), seed, reset                                                                     |
| UI     | `packages/ui`            | React, CSS tokens                                                 | Design tokens, Tailwind theme, fonts, `PackShot` drawn packs                                                         |

Dependency direction is one-way: `apps/*` → `packages/ui` / `packages/db` → `packages/core`. `packages/core` imports nothing from the repo and does no I/O, so every rule in it is unit-tested without a database.

## Rules the code relies on

- **Money is an integer number of paise.** No floats. `packages/core/src/money.ts` is the only place that formats or converts.
- **Dates are IST business dates** (`YYYY-MM-DD` strings) from `packages/core/src/time.ts`. India has no daylight saving, so plain UTC arithmetic is used.
- **Ids are prefixed and sortable** (`ord_…`, `cus_…`), made by `newId()` in `packages/core/src/ids.ts`.
- **One state machine for orders** (`packages/core/src/orders.ts`): `pending_payment → confirmed → packed → shipped → delivered`, with `cancelled` and `refunded`. Every transition goes through `transition()` in `apps/api/src/services/orders.ts`, which records history, queues the customer email and releases stock when needed, all in one database transaction.
- **Stock is reserved at checkout** (first-expiry-first-out batches, `packages/core/src/fefo.ts`) and released if the order expires or is cancelled.
- **Prices include GST.** Tax is back-calculated per line (`gst.ts`); coupon discounts are spread across lines (`discount.ts`) so GST stays exact.

## Request flows

**Browsing.** The shop renders pages on the server and fetches catalogue data from the API (`API_INTERNAL_URL`) with short caches (ISR). Browser calls such as the basket quote use `/api/*` on the shop's own address, which Next.js forwards to the API, so cookies stay first-party.

**Sign-in.** The browser gets a Google ID token (with a nonce the API issued). `POST /v1/auth/google` verifies issuer, audience, expiry, nonce and verified email, creates or finds the customer, and returns short-lived access tokens (Ed25519 JWT, 15 minutes) plus a rotating refresh token. Web clients receive them as httpOnly cookies with a CSRF double-submit token; mobile clients use bearer tokens. A reused refresh token revokes the whole session family. Staff use the same flow; their permissions come from roles. See [docs/04-authentication.md](docs/04-authentication.md).

**Checkout and payment.**

1. `POST /v1/store/checkout/quote` prices the basket: unit prices, coupon, GST split, shipping zone and ETA from the pincode.
2. `POST /v1/store/checkout/orders` (with an `Idempotency-Key`) locks stock, creates the order as `pending_payment` and a payment attempt, and returns Cashfree's payment session. Orders unpaid after 30 minutes are expired by the worker and stock is released.
3. The customer pays in Cashfree's own checkout (the shop never sees card data).
4. Cashfree calls `POST /v1/webhooks/cashfree`. The API verifies the HMAC signature, deduplicates the event, marks the payment paid and moves the order to `confirmed`, which queues the confirmation email. If a webhook is missed, the worker asks Cashfree about each order before expiring it, so a paid order is never lost.
5. Staff pack and ship in the admin (courier and tracking number are entered by hand today); the customer is emailed at each step.

Refunds go through the same provider interface. In development a mock provider replaces Cashfree, so nothing real is charged.

**Emails.** Order events write a row to a `notification_outbox` table in the same transaction as the order change, so an email is never lost or sent for a rolled-back change. The worker sends pending rows (up to 5 attempts) via the configured provider (`log`, `resend` or `brevo`).

**Photos.** The admin uploads originals to the API. `sharp` strips metadata (GPS), validates the file and stores WebP versions at 480, 960 and 1600 px. Storage is a driver: Cloudflare R2 (recommended) or the server's disk (development, or a small single server).

**Delivery location.** The shop can ask for the browser's location, show a map pin, and call the API's `/store/geo/reverse`, which asks Nominatim (cached for 30 days) to fill area, city and pincode. The saved latitude and longitude become a directions QR code on the packing slip for the courier. See [docs/16-location-and-delivery.md](docs/16-location-and-delivery.md).

## Data

PostgreSQL 17 (16 also works) with the `pg_trgm` extension for search. Two roles: the **migrator** owns the tables and runs migrations; the **app** role used by the API and worker can only read and write rows. Migrations are plain SQL in `packages/db/drizzle/` (0001 to 0007), generated with `pnpm db:generate` and applied with `pnpm db:migrate`. See [docs/05-data-model.md](docs/05-data-model.md).

The API's idempotency keys, webhook dedupe and audit log are Postgres tables, so Valkey only holds data that is safe to lose (rate-limit counters and caches).

## Security model

- All input is validated by TypeBox schemas on every route; errors are RFC 9457 `problem+json` and never leak internals.
- Permissions are checked per route (`config: { auth, permission }`). Staff roles: owner, admin, ops_manager, warehouse, support, content, accountant (`packages/db/src/schema.ts`).
- Cookies are `httpOnly`, `Secure` and `SameSite`; state-changing cookie requests need the CSRF header. CORS allows only `CORS_ORIGINS`.
- Rate limits: per user or IP in the API (Valkey), plus per-IP limits in Nginx on the API and sign-in paths.
- The API trusts `X-Forwarded-For` (`trustProxy`), so **only the reverse proxy may reach it**: in production the containers listen on `127.0.0.1` and the firewall allows only 22, 80 and 443.
- The shop sets a strict Content-Security-Policy, HSTS (production), frame and referrer protections (`apps/web/next.config.ts`); the admin gets its headers from Nginx.
- The API refuses to start in production without Google, signing-key settings, and a valid photo storage setting, and refuses `AUTH_TEST_MODE`. Secrets live only in the server's `.env` file (mode 600) and are never in the repository.
- Containers run as a non-root user; the shop container receives no database or payment secrets.
- Details and the threat list: [docs/10-security-privacy.md](docs/10-security-privacy.md).

## Deployment shape

One Linux server runs Docker Compose (`infra/compose/single.yml`): Postgres, Valkey, a one-shot migration job, API, worker, shop and the admin's static files. Host **Nginx** terminates HTTPS (Let's Encrypt) and routes by hostname; every container port is bound to `127.0.0.1`. Alternatively Cloudflare Tunnel can replace Nginx (`--profile tunnel`). Backups are a nightly `pg_dump` (plus the photo folder when R2 is not used). The full guide is [DEPLOYMENT.md](DEPLOYMENT.md).

This is deliberately small. It comfortably serves thousands of customers a day. The parts scale independently when needed: add API replicas behind Nginx (the API is stateless), move Postgres to a managed service (change `DATABASE_URL`), serve photos from R2/CDN. Nothing in the code has to change for that.

## Where to change things

| I want to…                                                 | Look in                                                                                                                       |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Change a pricing, shipping, GST, stock or order-state rule | `packages/core/src` (and its tests), then the service that uses it in `apps/api/src/services`                                 |
| Add an API endpoint                                        | `apps/api/src/routes/{store,admin}`; register it in `app.ts`; run `pnpm --filter @dairy/api spec ../../docs/api/openapi.json` |
| Add or change a table                                      | `packages/db/src/schema.ts`, then `pnpm db:generate` and commit the new SQL file                                              |
| Add a setting/env variable                                 | `apps/api/src/config.ts` (validated at start-up), `.env.example`, `.env.production.example`                                   |
| Change how the shop looks                                  | `packages/ui/tokens.css` and `theme.css` (tokens only), components in `apps/web/src/components`                               |
| Add an admin screen                                        | `apps/admin/src/pages`, register it in `App.tsx`                                                                              |
| Change an email                                            | `apps/api/src/services/order-emails.ts`                                                                                       |
