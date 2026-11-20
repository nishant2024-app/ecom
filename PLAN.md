# Dairy E-commerce Platform: Build Plan (v2)

A single-brand dairy store for India with daily milk subscriptions, one-time orders, a prepaid wallet, Cashfree payments in INR, and a full admin and delivery operations panel. A public Fastify API serves the website, the admin panel and a future Android app. Everything runs on free tiers, built to handle 50,000 to 100,000 users, and the code is structured so multi-vendor can be switched on later without a rewrite.

**What changed from v1:** dairy-specific domain (subscriptions, delivery slots, batches, wallet), Cashfree instead of Stripe, Fastify API-first backend, self-hosted zero-cost infrastructure instead of Vercel and Supabase, Android-ready API, a multi-vendor-ready schema, and a new design direction.

---

## 0. Decisions (answered)

| # | Question | Answer | What it means for the build |
|---|---|---|---|
| 1 | What do we sell? | Dairy products | Perishables: delivery slots, order cutoffs, daily subscriptions, batch and expiry tracking, pincode serviceability |
| 2 | Payments | Cashfree, INR | Cashfree Payment Gateway for orders and wallet top-ups, Cashfree Subscriptions (UPI Autopay) for auto-recharge |
| 3 | Vendors | Single brand now, multi-vendor later | A `seller_id` on every product, stock and order line from day one. One seller is seeded. |
| 4 | Hosting | Not Vercel or Supabase. Fastify for APIs. | Self-hosted Docker stack on Oracle Cloud Always Free behind Cloudflare's free tier (section 3) |
| 5 | Budget | Zero hosting cost, now and later, for 50k to 100k users. APIs reusable by Android. | Free-tier architecture with honest limits (section 3.5). Versioned, OpenAPI-documented REST API (section 6). |

### 0.1 Why moving off Vercel and Supabase is right (with the precise reasons)

- **Vercel Hobby (free) does not allow commercial use.** Vercel's fair use guidelines limit Hobby to non-commercial personal use. Any store needs the Pro plan, which is paid. Vercel itself is widely used in industry; the problem is that its free plan can't legally run a shop.
- **Supabase free projects pause after 7 days without activity,** and the free database caps are small. Not acceptable for a production store.
- **What "industry standard" actually means** is the practice, not the host: containers, infrastructure as code, CI/CD, point-in-time database backups, monitoring and alerting, and secrets kept out of code. This plan does all of that. The whole stack is portable: moving to AWS, GCP, DigitalOcean or Hetzner is a `docker compose up` on a new server plus a database restore, with no code changes.

---

## 1. Anti-AI-slop rules

These carry over from v1 unchanged. Default output from nobody making a decision is banned by name.

### 1.1 Banned patterns and replacements

| Slop | Instead |
|---|---|
| Purple/blue gradients, glowing blobs | Flat color. The accent color covers under 5% of any screen. |
| Glassmorphism, soft shadows everywhere | 1px rules, borders and whitespace for structure. Shadows only on things that float. |
| `rounded-2xl` on everything | Radius scale 0 / 2 / 4px. Pills only for chips. |
| Inter for everything | A real bilingual type pairing (2.2) |
| Centered hero, two buttons, 3-column icon grid | Asymmetric layouts on a grid. Real product and farm photography leads. |
| Emoji and decorative icons | Icons only where they mean something |
| "Elevate", "Unlock", "Seamless", "Farm-fresh goodness delivered with love" | Specific facts: fat %, source farm, milking time, pack date, shelf life |
| Fade-up on scroll everywhere | Motion only to explain a state change |
| AI-generated cows and stock photos | A photography brief: our farm, our packs, steel utensils, morning light |

### 1.2 Principles

1. Recognizable with the logo removed.
2. Typography and numbers carry hierarchy before color does.
3. The storefront is calm and large-print. The admin is dense and keyboard-first.
4. Built for the real Indian user: a ₹8,000 Android phone, patchy 4G, Hindi or English, and sometimes a 65-year-old placing the order.

### 1.3 Review gate

Every UI pull request must pass the checklist in Appendix A.

---

## 2. Design direction: "Milk Card"

Many Indian households keep a milk card: a printed monthly calendar where each day's delivery is ticked and the month is settled at the end. That card becomes the core of the interface. Customers see their subscription as a month grid with a quantity in each day, ticks for delivered days and strikes for paused ones. Tapping tomorrow changes the quantity, until the cutoff. The wallet and monthly statement keep the receipt motif from v1: monospaced amounts and a running balance.

This gives the brand a visual identity that comes from how the business actually works, which is the opposite of slop.

### 2.1 Color tokens

| Token | Light | Dark | Use |
|---|---|---|---|
| `--paper` | `#F6F2E7` (cream) | `#0F1424` | Background |
| `--paper-2` | `#ECE6D6` | `#171D31` | Raised surfaces, calendar cells |
| `--ink` | `#1B2340` (ballpoint navy) | `#ECE8DC` | Text, primary buttons |
| `--ink-2` | `#5B6075` | `#A3A7B8` | Secondary text |
| `--rule` | `#D6CFBC` | `#2A3149` | Hairlines, calendar grid |
| `--signal` | `#E3A21A` (marigold) | `#F0B53A` | Accent **fill only**, never text on cream (fails contrast). Today's cell, primary call-to-action background with ink text. |
| `--tick` | `#2F7A4B` | `#5DBB83` | Delivered tick |
| `--alert` | `#B93A2B` | `#E5634F` | Low wallet balance, missed delivery, errors |

All text pairs meet WCAG AA, checked by a contrast script in CI.

### 2.2 Typography (Latin and Devanagari)

- **Display:** *Tiro Devanagari Hindi* (free, includes matching Latin) for headings in both scripts.
- **UI / text:** *Mukta* (free, Latin and Devanagari designed together). 16px minimum on the storefront.
- **Numbers:** *JetBrains Mono* with tabular figures for prices, quantities, litres, wallet amounts and order numbers.
- Money is always formatted with `Intl.NumberFormat('en-IN')` in Indian grouping: ₹1,00,000.
- Fonts are self-hosted and subset per script, so a Hindi-only page doesn't download Latin glyphs.

### 2.3 Signature components

- **Milk card calendar:** a month grid. Each cell shows quantity and status. Long-press or tap to edit. Pause a date range by dragging. It is fully keyboard and screen-reader accessible (an ARIA grid).
- **Wallet statement ("hisaab"):** a receipt-style ledger with dotted leaders between item and amount, daily debits, top-ups and running balance.
- **Product card:** photo, name in both languages if chosen, pack size, fat % and price in mono. A small green veg mark (required on Indian food packaging). No card box.
- **Cutoff banner:** "Change tomorrow's order until 10:00 PM". It shows a live countdown in the last hour only.

### 2.4 Motion

- Motion (`motion/react`) for UI, Remotion for video (section 7).
- Durations 120 / 200 / 320ms, one standard easing.
- Allowed: calendar cell flip when quantity changes, tick drawn on delivery, wallet balance ticker, drawer slides, shared-element transition from product card to product page.
- `prefers-reduced-motion` and a "Lite mode" toggle (for low-end phones) turn transitions off.

### 2.5 First design deliverables

Tokens and a type specimen, then three high-fidelity screens: **home**, **subscription calendar**, **admin daily dispatch board**. Everything else follows their patterns.

---

## 3. Zero-cost infrastructure

### 3.1 Topology

```
                         Customers (web, Android)          Staff
                                   │                         │
                    ┌──────────────▼─────────────────────────▼───────────┐
                    │ Cloudflare Free: DNS · CDN · SSL · WAF · DDoS       │
                    │  - caches storefront HTML (ISR) and images          │
                    │  - Pages: hosts admin SPA                           │
                    │  - Access (Zero Trust, 50 free seats): guards admin │
                    │  - R2: product images, videos, backups (no egress)  │
                    └──────────────┬─────────────────────────────────────┘
                                   │ Cloudflare Tunnel (no open ports on servers)
            ┌──────────────────────▼───────────────────────┐
            │ Oracle Cloud Always Free (Mumbai/Hyderabad)  │
            │                                              │
            │  VM-APP (Ampere ARM)        VM-DATA (ARM)    │
            │  ├ cloudflared              ├ PostgreSQL 17  │
            │  ├ Next.js storefront       │   + PostGIS    │
            │  ├ Fastify API ×N           ├ Valkey (cache, │
            │  ├ BullMQ workers           │   queues)      │
            │  └ Remotion renderer        └ pgBackRest ────┼──► R2 + OCI Object Storage
            │                                              │
            │  Micro VM (AMD, 1 GB): uptime monitor,       │
            │  backup restore tests                        │
            └──────────────────────────────────────────────┘
```

### 3.2 Service by service

| Need | Service | Free limit | Expected use at 100k users |
|---|---|---|---|
| Compute | Oracle Cloud Always Free, Ampere A1 | Historically 4 OCPU / 24 GB. Some 2026 reports say Always Free accounts were cut to 2 OCPU / 12 GB (unconfirmed). **We size for 2 / 12 to be safe.** | Fits; see 3.4 |
| Block storage | Oracle | 200 GB total | ~100 GB across VMs |
| CDN, DNS, SSL, WAF, DDoS | Cloudflare Free | Unlimited CDN bandwidth | Most storefront traffic served from cache |
| Ingress | Cloudflare Tunnel | Free | Servers have no public ports |
| Admin hosting | Cloudflare Pages | Free, commercial use allowed | Static SPA |
| Admin protection | Cloudflare Access | 50 users free | Staff login in front of the admin app, before our own auth |
| Images, videos | Cloudflare R2 | 10 GB storage, zero egress fees | A dairy catalog of ~200 SKUs in 5 sizes plus videos is ~2–4 GB |
| Database | PostgreSQL 17 + PostGIS, self-hosted | Free (open source) | Our own server; no pausing, no row caps |
| Cache, sessions, rate limits, queues | Valkey (open-source Redis fork) + BullMQ | Free | Same |
| Backups | pgBackRest: nightly full + continuous WAL to R2 and OCI Object Storage | R2 10 GB, OCI 20 GB | Two providers, so one outage can't lose data |
| Transactional email | Brevo free (300/day) + Resend free (100/day) | ~400/day combined | Only essential mail (invoices, statements). Everything else goes to push. |
| Push notifications | Firebase Cloud Messaging (Android) + Web Push (VAPID) | Free, no cap | Delivery done, low balance, cutoff reminders |
| Maps | Leaflet + Protomaps tiles stored on R2, India Post pincode open data | Free | Address pin, delivery zones |
| Error tracking | Sentry free tier (or self-hosted GlitchTip) | 5k errors/month | Enough with sampling |
| Metrics and logs | Prometheus + Grafana + Loki on VM-DATA, or Grafana Cloud free | Free | Dashboards and alerts |
| Uptime | Uptime Kuma (micro VM) + UptimeRobot free | Free | Alerts to Telegram or email |
| CI | GitHub Actions | Free minutes (unlimited if repo is public) | Lint, type check, tests |
| Deploy | GitHub Actions → SSH over Cloudflare Tunnel → `docker compose` builds on the VM | Free | Zero-downtime rolling restart |
| Infrastructure as code | OpenTofu (Terraform) for Oracle + Cloudflare, Ansible for server setup | Free | Rebuild everything from the repo |

### 3.3 Risks of free tiers and how we handle them

| Risk | Mitigation |
|---|---|
| **Oracle reclaims "idle" Always Free VMs** (low CPU/network/memory over 7 days) | A live store isn't idle, and the nightly jobs add load. Stronger fix: upgrade the account to Pay-As-You-Go. It still costs ₹0 inside the free limits, and reclamation rules target Always Free-only accounts. Set a ₹1 budget alert so any accidental charge is caught at once. |
| **Oracle changes or cuts the free tier** (it reportedly happened in 2026) | Size for the smaller 2 OCPU / 12 GB. Everything is containerized and in OpenTofu. Off-site backups in R2. A written runbook to move to any VPS in under 2 hours. |
| **ARM capacity unavailable** in Mumbai/Hyderabad when creating VMs | Retry script. The home region choice is permanent, so pick it deliberately. Fallback: smaller VMs first, resize later. |
| **No SLA, single server** | Cloudflare keeps serving cached pages if the origin is down ("Always Online"). Health checks, auto-restart, tested restores. Upgrade path documented below. |
| **Free email caps** | Push and in-app notifications first; email only for invoices and statements |

**Honest upgrade path:** if the business grows past what free can carry, the same stack moves to a paid ARM VPS (around ₹400–1,500/month at providers such as Hetzner or Oracle paid) with no code changes. Plan for this as a business decision, not an emergency.

### 3.4 Can it really handle 50k–100k users?

Back-of-envelope for 100,000 registered users:

- About 15% open the app or site each day: ~15,000 daily active users.
- About 30 API calls each per day: ~450,000 requests/day, ~5 requests/second on average.
- Dairy traffic spikes in the evening before the order cutoff and in the early morning. Assume 15x average at peak: **~75–100 requests/second.**
- A Fastify API on 2 ARM cores with Valkey caching and indexed Postgres queries typically handles well over 1,000 simple requests/second. That's roughly 10x headroom.
- Product pages, images and videos come from Cloudflare's cache and never reach the server.
- The nightly job that turns ~30,000 active subscriptions into tomorrow's deliveries is a few set-based SQL statements: seconds, not minutes.

**Proof, not promises:** Phase 8 includes a k6 load test. The pass criterion is 500 requests/second sustained on the realistic endpoint mix, p95 latency under 200ms and no errors, on the 2 OCPU / 12 GB configuration.

### 3.5 Costs that cannot be zero

| Item | Cost | Notes |
|---|---|---|
| Domain name (`.in` or `.com`) | ~₹700–1,200 per year | Needed for a professional store and for Cloudflare |
| Cashfree transaction fees | A percentage per payment, deducted from settlements | No fixed hosting-style fee. UPI usually costs far less than cards; check Cashfree's current pricing. |
| SMS OTP (if used) | ~₹0.15–0.25 per SMS with DLT registration | Launch with Google sign-in and email OTP (free). Add phone OTP when revenue covers it, or evaluate the Truecaller SDK and Firebase Auth free quotas. |
| Google Play developer account | $25 one time | Only when the Android app ships |
| Remotion | Free if the company has 3 people or fewer | From 4 people, a paid Company License is needed. If that happens, we switch to **Revideo** (MIT license, free at any size). Video templates are kept behind an interface so the switch is contained. |
| FSSAI license, GST registration | Government fees | Legal requirements, not technology, but the site must show the FSSAI number |

---

## 4. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Monorepo | pnpm + Turborepo | Shared types and packages |
| API | **Fastify 5** + TypeScript, TypeBox schemas | Fast, schema-first. The same schemas validate requests and generate OpenAPI. |
| API plugins | `@fastify/swagger` + Scalar docs, `@fastify/jwt`, `@fastify/cookie`, `@fastify/rate-limit` (Valkey store), `@fastify/helmet`, `@fastify/cors`, `@fastify/multipart`, `@fastify/under-pressure` | Security, docs, load shedding |
| Database | PostgreSQL 17 + PostGIS + `pg_trgm`, Drizzle ORM, SQL migrations | Typed, portable, no vendor lock-in |
| Jobs | BullMQ on Valkey | Subscription generation, wallet debits, notifications, renders, reconciliation |
| Auth | Better Auth on Fastify (or a small in-house JWT module) | Cookie sessions for web, bearer tokens for Android, staff 2FA |
| Payments | Cashfree PG (Orders API + JS / Android SDKs), Cashfree Subscriptions (UPI Autopay), Easy Split later for vendors | |
| Storefront | **Next.js**, self-hosted in standalone mode, ISR for catalog pages, PWA | SEO, fast first load, installable, web push |
| Admin | **Vite + React SPA**: TanStack Router, Query and Table, `cmdk` | No SSR needed. Free static hosting on Cloudflare Pages. |
| UI | Tailwind v4 with only our tokens, Radix primitives restyled from scratch | |
| Forms | React Hook Form + validation from the shared TypeBox schemas | One source of truth with the API |
| Video | Remotion rendered on our own VM with `@remotion/renderer` (no Lambda, no AWS bill) | Section 7 |
| Images | `sharp` in the API: resize to AVIF/WebP at upload, store sizes in R2 | No paid image service |
| Search | Postgres full-text + trigram, with Hindi/Hinglish synonyms (doodh → milk, dahi → curd, makhan → butter, chaas → buttermilk) | Catalog is small; no separate search server needed |
| i18n | English + Hindi at launch, structure ready for more languages | |
| Testing | Vitest, Playwright, axe-core, k6 | |
| Android (later) | React Native (Expo) recommended for a TypeScript team, sharing the API client and types. Kotlin + Jetpack Compose is a fine alternative. Either uses the same API. | |

---

## 5. Repository layout

```
ecom/
├─ apps/
│  ├─ api/          Fastify: /v1 REST API, webhooks, BullMQ workers
│  ├─ web/          Next.js storefront + customer account + PWA
│  ├─ admin/        Vite React SPA: admin + dispatch board
│  ├─ agent/        Delivery agent PWA (route list, mark delivered, bottle returns)
│  └─ video/        Remotion compositions
├─ packages/
│  ├─ db/           Drizzle schema, migrations, seed
│  ├─ core/         Pure domain logic: pricing, GST, subscriptions, wallet ledger,
│  │                cutoffs, order state machine, FEFO batch allocation
│  ├─ contracts/    TypeBox schemas → OpenAPI spec → generated TS client
│  ├─ ui/           Tokens, fonts, primitives, milk-card calendar
│  ├─ emails/       React Email templates
│  └─ config/       tsconfig, eslint, tailwind preset
├─ infra/
│  ├─ tofu/         OpenTofu: Oracle VMs, network, Cloudflare DNS/Tunnel/Access/R2
│  ├─ ansible/      Server hardening, Docker, users, firewall, fail2ban
│  ├─ compose/      docker-compose.yml per VM
│  └─ runbooks/     Deploy, restore, migrate-host, incident
└─ .github/workflows/
```

All business rules live in `packages/core` as pure, unit-tested functions. Fastify routes are thin.

---

## 6. API design (website, admin and future Android app)

The website, admin and Android app all use the same public API. Nothing is website-only.

- **Versioned:** everything under `/v1`. Breaking changes go to `/v2`, and `/v1` stays alive while old app versions are still in use.
- **Documented:** OpenAPI 3.1 generated from code, browsable at `/docs`. The Android client is generated from the same spec (OpenAPI Generator for Kotlin, or the shared TS client for Expo).
- **Route groups by audience:**
  - `/v1/store/*`: customers (catalog, cart, checkout, subscriptions, wallet, account)
  - `/v1/agent/*`: delivery agents
  - `/v1/admin/*`: staff, checked against role permissions
  - `/v1/seller/*`: reserved for future vendors
  - `/v1/webhooks/cashfree`: payments (signature-verified)
- **Auth:** short-lived access token (15 min) and rotating refresh token (30 days, stored hashed, revocable per device). The website uses httpOnly cookies, Android uses bearer tokens. A sessions-per-device list lets users log out other devices.
- **Safety:** an `Idempotency-Key` header is required on order, payment and wallet endpoints, so a flaky mobile connection can't double-charge. Rate limits per IP and per user. Errors in a single format (RFC 9457 `problem+json`).
- **Mobile-friendly:** cursor pagination, `ETag` / `If-None-Match` for catalog caching, compact responses, an `/v1/app-config` endpoint for minimum supported app version (forced updates) and feature flags.
- **Push:** `/v1/store/devices` registers FCM tokens.
- **Time:** timestamps stored in UTC. Business dates (delivery day, cutoff) always in `Asia/Kolkata`.

---

## 7. Dairy domain features

### 7.1 Customer side (web now, Android later)

- **Serviceability check first:** enter pincode or drop a map pin. Delivery zones are polygons (PostGIS) mapped to pincodes and societies or areas.
- **Catalog:** milk (cow, buffalo, A2, toned, full cream), curd, paneer, ghee, butter, buttermilk, lassi, cheese, sweets. Attributes: pack size, fat %, SNF, source, pasteurized or raw, packaging (pouch or glass bottle), shelf life, storage temperature, nutrition table, veg mark, FSSAI number.
- **Subscriptions:** daily, alternate days, chosen weekdays, or custom quantity per day. Pause for a date range ("vacation mode"). Change tomorrow's quantity until the cutoff. All shown on the milk-card calendar.
- **One-time orders:** add to tomorrow's delivery, or schedule for a date.
- **Delivery slots:** morning (e.g. 5–8 AM) and optionally evening. A configurable cutoff per slot (e.g. 10 PM the night before).
- **Prepaid wallet:** top up via Cashfree (UPI, cards, net banking). Deliveries debit the wallet each day. Low-balance warnings. Optional auto-recharge with UPI Autopay mandates (Cashfree Subscriptions).
- **Monthly statement:** a "hisaab" view and downloadable PDF with GST invoice details.
- **Bottle deposits:** for glass bottles, track deposit, bottles out and bottles returned.
- **Account:** addresses with delivery instructions ("ring bell", "leave at door", "give to guard"), order history, referrals, language choice.

### 7.2 Operations (admin)

- **Nightly cutoff job:** at the cutoff, generate tomorrow's deliveries from subscriptions + one-time orders, reserve stock, debit or hold wallet amounts, and skip customers with insufficient balance (with a notification). It's idempotent, with one delivery per customer per date enforced by a unique constraint.
- **Production planning:** "tomorrow we need 2,140 L of toned milk, 380 curd 400g, …" from subscription totals plus a forecast for one-time orders.
- **Batches and expiry:** stock tracked by batch with manufacture and expiry dates. Allocation is first-expiry-first-out (FEFO). Wastage is recorded with a reason.
- **Dispatch board:** tomorrow's deliveries grouped by route, packing lists by route, printable route sheets.
- **Routes and agents:** assign areas to agents, order stops along the route, track progress live from the agent app.
- **Delivery agent PWA:** today's stops in order, call customer, mark delivered / not available / refused, collect bottles, photo proof. Works on a cheap phone and offline, syncing when the network returns.
- **Missed deliveries:** automatic wallet credit or redelivery, by rule.
- **Customers and support:** customer profile with calendar, wallet ledger and complaints. Staff can pause, credit or adjust with an audit trail.

### 7.3 Full admin module list

| Module | Key features |
|---|---|
| Dashboard | Tomorrow's volume by product, active subscriptions, wallet float, revenue, new vs churned subscribers, low-stock and near-expiry alerts |
| Dispatch | Cutoff status, route sheets, packing lists, live delivery progress |
| Subscriptions | Search, edit, pause, bulk actions, churn reasons |
| Orders | One-time orders, timeline, refunds, GST invoices |
| Products | Variants (pack sizes), pricing, per-zone availability, media, bilingual names and descriptions |
| Inventory | Batches, FEFO, stock movements ledger, wastage, production plan |
| Customers | Profiles, segments, wallet, bottle balance, notes |
| Wallet & payments | Ledger, top-ups, Cashfree reconciliation, refunds, UPI Autopay mandates |
| Zones & delivery | Pincodes, polygons on a map, slots, cutoffs, routes, agents |
| Promotions | Coupons, first-month offers, referral rewards, free trial packs |
| Content | Homepage blocks, banners, pages, FAQs, notifications composer |
| Campaign Studio | Remotion video templates (section 8) |
| Reports | Sales, GST (HSN-wise), product, route, agent performance, wastage; CSV export |
| Settings | Store, tax rates per HSN code (configurable; verify rates with your CA, since dairy GST rates differ by product and changed in 2025), staff and roles, API keys, webhooks |
| Audit log | Every staff action with before/after values |

**Roles:** Owner, Admin, Operations manager, Dispatch, Delivery agent, Support, Content editor, Accountant (read-only finance). Every check happens on the server.

---

## 8. Remotion: video where it earns its place

Rendered on our own VM by a BullMQ worker at low priority (mostly overnight), concurrency 1, outputs stored in R2. No Lambda, no AWS bill.

| Use | Where it appears |
|---|---|
| **Farm-to-door product reels:** 6–10s clips per product built from product data and farm photos | Product page, WhatsApp and Instagram sharing |
| **"Your month in milk":** a personal monthly recap ("31 deliveries, 46 L, 2 pauses, ₹180 saved with subscription") | Monthly statement page, shareable, drives referrals |
| **Festival campaigns** (Diwali ghee and sweets, Janmashtami, Holi): templates where staff pick products and copy, then export 9:16, 1:1 and 16:9 | Admin Campaign Studio with live `@remotion/player` preview |
| **Animated delivery receipt:** the receipt prints line by line | Order confirmation |
| **Weekly owner recap:** volumes, revenue, churn | Admin dashboard |

Rules:
- The storefront ships pre-rendered MP4/WebM files with poster images, loaded only when visible. The Remotion Player loads only in admin previews.
- Compositions import tokens and fonts from `packages/ui`, so video and site look like one brand.
- Each template has a typed props schema. The Campaign Studio form is generated from it.
- Renders are cached by a hash of template version and props, with a daily render quota in settings.
- **License:** free for teams of 3 or fewer. If the company grows to 4+, swap the renderer to Revideo (MIT) behind the same `VideoRenderer` interface.

---

## 9. Data model

Money is stored in paise (integers), never floats. Every seller-owned table carries `seller_id`.

- **Sellers (multi-vendor ready):** `sellers` (one seeded row), `seller_users`, later `seller_payout_accounts`, `payouts`
- **Catalog:** `products`, `product_variants` (pack size, unit, price, MRP, HSN code, GST rate), `product_media`, `categories`, `zone_availability`
- **Zones and delivery:** `delivery_zones` (PostGIS polygon), `zone_pincodes`, `delivery_slots`, `cutoff_rules`, `routes`, `route_stops`, `agents`
- **Customers:** `customers`, `addresses` (geo point, instructions), `devices` (FCM tokens), `sessions`
- **Subscriptions:** `subscriptions`, `subscription_items` (quantity by weekday or pattern), `subscription_pauses`, `subscription_overrides` (per-date changes)
- **Deliveries:** `deliveries` (customer × date × slot, unique), `delivery_items`, `delivery_events` (assigned, out for delivery, delivered, missed), `proof_photos`
- **Orders:** `orders`, `order_items` (price and tax snapshot), `seller_orders` (fulfillment unit per seller, always created even with one seller), `refunds`, `invoices`
- **Wallet:** `wallets`, `wallet_ledger` (append-only, double-entry: every row has a balancing counterpart), `topups`, `autopay_mandates`
- **Payments:** `payments` (Cashfree order and payment IDs), `webhook_events` (raw, deduplicated by event ID)
- **Inventory:** `batches` (mfg date, expiry date), `stock_levels`, `stock_movements` (append-only), `wastage`, `production_plans`
- **Bottles:** `bottle_ledger`
- **Content and marketing:** `pages`, `blocks`, `banners`, `coupons`, `referrals`, `notifications`, `video_templates`, `video_renders`
- **Admin:** `staff`, `roles`, `permissions`, `audit_log`, `api_keys`, `settings`

**Multi-vendor switch-on later** means: seller onboarding and KYC screens, a seller panel (same admin app, scoped by `seller_id`), Cashfree Easy Split for automatic payouts, and per-seller commission rules. No schema rewrite.

---

## 10. Cashfree integration

- **One-time orders and wallet top-ups:** create a Cashfree order on the server (with our idempotency key), open checkout with the Cashfree JS SDK on web or the Android SDK later. UPI intent is shown first on mobile.
- **The server is the source of truth:** an order is marked paid only from a verified webhook or a server-side status check, never from the browser redirect.
- **Webhook verification:** HMAC-SHA256 with our secret over the timestamp and the **raw** request body, from the `x-webhook-signature` and `x-webhook-timestamp` headers. Cashfree's docs show two slightly different signed-string formats, so the exact format is pinned by a sandbox test before go-live. Events are stored raw and deduplicated.
- **Auto-recharge:** UPI Autopay mandates through Cashfree Subscriptions. Customers approve once in their UPI app; the wallet tops up when it drops below a threshold.
- **Refunds** through the Cashfree Refunds API, reflected in the wallet ledger.
- **Daily reconciliation job** compares our payments with Cashfree settlement reports and flags mismatches in admin.
- Cashfree sits behind a `PaymentProvider` interface, so a second gateway (e.g. Razorpay as backup) can be added later.

---

## 11. Phased delivery

Estimates assume one experienced full-stack developer working with AI assistance. Each phase ends with a deployed staging environment and a demo.

| Phase | Weeks | Scope | Done when |
|---|---|---|---|
| **0. Foundations & infra** | 1–2 | Monorepo, CI, OpenTofu for Oracle + Cloudflare, Ansible hardening, Docker Compose, Cloudflare Tunnel, Postgres + backups to R2 and OCI, monitoring and alerts | A blank API and site are live on our domain over HTTPS. A backup has been restored to a fresh server successfully. |
| **1. Design system** | 2–3 | Tokens, bilingual fonts, primitives, milk-card calendar component, `/design` specimen, three key screens | Components pass axe, visual snapshots and the slop checklist in light, dark and Lite modes |
| **2. API core & catalog** | 3–5 | Auth (web + bearer), RBAC, OpenAPI docs, products and media upload, zones and serviceability, storefront catalog with ISR, search | A product created in admin appears on the site, available only in its zones |
| **3. Cart, checkout & wallet** | 5–7 | Cart, GST pricing, coupons, Cashfree payments and webhooks, wallet ledger, top-ups, invoices | Playwright test: top up wallet with a sandbox payment, place an order, ledger and invoice are correct |
| **4. Subscriptions** | 7–9 | Subscription rules, pauses, overrides, milk-card calendar UI, nightly cutoff job, UPI Autopay | 1 month of simulated subscriptions generates correct deliveries and debits every day (property-based tests) |
| **5. Delivery operations** | 9–11 | Batches and FEFO, production plan, dispatch board, routes, agent PWA with offline sync, missed-delivery rules, bottle tracking | Dry run with real staff: one full morning of deliveries completed using only the system |
| **6. Admin completeness** | 11–12 | Reports (incl. GST HSN-wise), CMS blocks, notifications (FCM, web push, email), referrals, audit log | Owner can run the business for a week from the admin alone |
| **7. Remotion video layer** | 12–13 | Self-hosted renderer, product reels, monthly recap, Campaign Studio | Publishing a product creates its reel automatically. A festival campaign exports in three ratios. |
| **8. Hardening & launch** | 13–15 | k6 load test (500 req/s target), security review (OWASP, webhook and auth tests, dependency audit), accessibility pass incl. Hindi screen reader, performance budgets, runbooks, soft launch in one zone | All gates green. Soft launch with real customers in one pincode cluster. |
| **9. After launch** | — | Android app on the same API; multi-vendor switch-on when needed | — |

**Total:** about 15 weeks for one developer, about 9–10 weeks for two (one on API and operations, one on storefront and admin UI).

### Performance budgets (enforced in CI)

- Storefront on a low-end Android phone over 4G: LCP under 2.5s, CLS under 0.05, INP under 200ms
- Under 120 KB first-load JS on catalog and calendar routes
- API p95 under 200ms at 500 req/s on the free-tier server size

---

## 12. Quality, security and operations

- **Unit tests** for everything in `packages/core`: subscription date generation (month ends, leap years, pauses overlapping overrides), cutoff times in IST, wallet ledger balancing, GST, FEFO. Property-based tests (fast-check) for subscriptions and the ledger.
- **Integration tests** for the Fastify API against a real Postgres in Docker. The OpenAPI spec is checked for breaking changes on every pull request.
- **End-to-end (Playwright)** for top-up → subscribe → cutoff job → agent delivers → statement is correct.
- **Security:** Cloudflare WAF + Access in front of admin, staff 2FA, no open server ports, SSH only via tunnel with keys, fail2ban, automatic security updates, secrets in an encrypted `.env` (SOPS + age) never committed, least-privilege database users, verified webhooks, rate limits, upload validation.
- **Data protection:** follows India's DPDP Act basics: consent for marketing, data export and deletion on request, minimal data collection.
- **Backups:** continuous WAL archiving for point-in-time recovery, nightly full backups to two providers, a monthly automated restore test on the micro VM.
- **Runbooks:** deploy, rollback, restore, rotate secrets, move to a new host, Cashfree outage, server down at 5 AM.

---

## 13. Next steps

1. Register the domain and add it to Cloudflare (the only upfront cost).
2. Create the Oracle Cloud account, choose the home region (Mumbai or Hyderabad, a permanent choice), and confirm which free ARM allocation the account actually gets.
3. Create a Cashfree merchant account and get sandbox keys.
4. Collect real farm and product photos, or schedule a shoot, so design isn't blocked on placeholders.
5. Confirm team size for the Remotion license (3 or fewer people stays free).
6. Start Phase 0 on this branch.

---

## Appendix A: Slop checklist (every UI pull request)

- [ ] No gradients, glows, blobs or glassmorphism
- [ ] Only token colors. Marigold is a fill, never text on cream, and covers under 5% of the screen.
- [ ] Radius 0, 2 or 4px (pills only for chips)
- [ ] No decorative shadows
- [ ] Tiro / Mukta / mono used as specified. Numbers tabular. Money in en-IN format.
- [ ] Works in Hindi as well as English, with no clipped Devanagari text
- [ ] Real photography only. No AI-generated food or animals.
- [ ] Copy states facts (fat %, pack date, source). None of: elevate, unlock, seamless, goodness, journey, curated.
- [ ] Every animation explains a change. Reduced-motion and Lite mode verified.
- [ ] Empty, loading, error and offline states designed
- [ ] Usable on a 360px-wide low-end phone with 48px tap targets
- [ ] Keyboard and screen reader path works. axe passes.
- [ ] Looks deliberate in light and dark
- [ ] Recognizable as this brand with the logo removed
