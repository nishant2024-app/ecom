# 02 · Architecture

## System context

```mermaid
flowchart LR
  subgraph Clients
    C[Customer browser<br/>Next.js storefront / PWA]
    A[Android app<br/>later]
    S[Staff browser<br/>Admin SPA]
    D[Agent phone<br/>Agent PWA]
  end

  subgraph Cloudflare["Cloudflare (free)"]
    CDN[CDN + WAF + DNS]
    PAGES[Pages<br/>admin + agent static files]
    ACCESS[Access<br/>staff gate]
    R2[(R2<br/>images, videos, backups)]
    TUN[Tunnel]
  end

  subgraph Oracle["Oracle Cloud Always Free"]
    WEB[Next.js server]
    API[Fastify API]
    WRK[BullMQ workers<br/>cutoff, notifications,<br/>reconciliation, renders]
    PG[(PostgreSQL 17<br/>+ PostGIS)]
    VK[(Valkey<br/>cache, queues,<br/>rate limits)]
  end

  G[Google Identity]
  CF[Cashfree]
  FCM[Firebase Cloud Messaging]
  MAIL[Brevo / Resend email]

  C --> CDN --> TUN
  A --> CDN
  S --> ACCESS --> PAGES
  D --> PAGES
  S -. API calls .-> CDN
  D -. API calls .-> CDN
  TUN --> WEB --> API
  TUN --> API
  API --> PG
  API --> VK
  WRK --> PG
  WRK --> VK
  API --> R2
  WRK --> R2
  API --> G
  API <--> CF
  WRK --> FCM
  WRK --> MAIL
```

## Components

### Fastify API (`apps/api`)

The only component that touches the database. Every client goes through it.

- **Route groups** by audience: `/v1/auth`, `/v1/store`, `/v1/agent`, `/v1/admin`, `/v1/webhooks`. Each group has its own auth hook and permission checks.
- **Schemas first:** each route declares TypeBox request and response schemas. Fastify validates input, serialises output quickly, and `@fastify/swagger` turns the same schemas into the OpenAPI spec.
- **Thin routes:** a route parses input, checks permissions, calls a function in `packages/core` or a service, and returns. Business rules never live in route handlers.
- **Runs as several processes** (Node cluster or multiple containers) behind Cloudflare Tunnel. Stateless: sessions and rate limits live in Valkey and Postgres, so any process can serve any request.
- **Load shedding:** `@fastify/under-pressure` returns `503` with `Retry-After` when the event loop or memory is overloaded, instead of falling over.

### Background workers (`apps/api`, worker entrypoint)

Same codebase, different entrypoint. BullMQ queues on Valkey:

| Queue | Jobs | Schedule |
|---|---|---|
| `cutoff` | Generate deliveries for a date and slot | At each slot's cutoff (repeatable job), plus manual re-run |
| `wallet` | Low-balance checks, autopay charges | After cutoff; on balance change |
| `notifications` | Push, email | On events |
| `payments` | Reconciliation with Cashfree settlements, stale payment checks | Daily 06:00 IST; every 10 min |
| `media` | Image resizing to AVIF/WebP sizes | On upload |
| `video` | Remotion renders | On demand, concurrency 1, low priority |
| `reports` | Heavy CSV exports, monthly statements | Nightly; on demand |
| `maintenance` | Expire carts, clean sessions, restore test trigger | Nightly |

Jobs are idempotent: running one twice must not double-debit, double-notify or duplicate rows. Each job has retry with backoff and a dead-letter queue visible in the admin.

### Storefront (`apps/web`)

Next.js in standalone mode inside Docker on the app VM.

- Catalog, product, category and content pages use **ISR**: rendered once, cached by Cloudflare, revalidated when admin changes the product (the API calls a revalidate endpoint).
- Account, cart, subscription calendar and wallet pages are dynamic and call the API.
- The Next.js server forwards `/api/*` to the Fastify API on the internal network, so browser requests are same-origin. This keeps auth cookies simple and avoids CORS for the storefront.
- PWA: installable, web push, offline page, cached "tomorrow's delivery" view.

### Admin and agent apps (`apps/admin`, `apps/agent`)

Static single-page apps built with Vite, deployed to Cloudflare Pages (free, commercial use allowed). They call `api.example.in` with cookies (see [Authentication](04-authentication.md)). The admin is additionally behind Cloudflare Access.

### Shared packages

| Package | Contents |
|---|---|
| `packages/core` | Pure domain functions: pricing, GST, subscription date expansion, cutoff times, wallet ledger postings, FEFO allocation, state machines. No I/O. Heavily unit-tested. |
| `packages/db` | Drizzle schema, migrations, seed data, query helpers |
| `packages/contracts` | TypeBox schemas shared by API and clients, generated OpenAPI file, generated TypeScript client |
| `packages/ui` | Design tokens, fonts, primitives, the milk-card calendar |
| `packages/emails` | React Email templates |

## Key flows

### 1. Browse a product page

```mermaid
sequenceDiagram
  participant B as Browser
  participant CF as Cloudflare CDN
  participant N as Next.js
  participant API as Fastify
  participant PG as Postgres
  B->>CF: GET /p/toned-milk-500ml
  alt cached (most requests)
    CF-->>B: HTML from edge cache
  else not cached / revalidating
    CF->>N: forward
    N->>API: GET /v1/store/products/toned-milk-500ml
    API->>PG: query (cached in Valkey 60s)
    PG-->>API: product
    API-->>N: JSON
    N-->>CF: HTML (s-maxage, stale-while-revalidate)
    CF-->>B: HTML
  end
  B->>CF: images from R2 (cached at edge)
```

### 2. Sign in with Google

See [Authentication](04-authentication.md#customer-sign-in-flow) for the full sequence.

### 3. Wallet top-up with Cashfree

```mermaid
sequenceDiagram
  participant B as Browser / App
  participant API as Fastify
  participant CF as Cashfree
  participant PG as Postgres
  B->>API: POST /v1/store/wallet/topups {amount} + Idempotency-Key
  API->>PG: insert topup (status=pending)
  API->>CF: Create order (order_id = topup id)
  CF-->>API: payment_session_id
  API-->>B: {topupId, paymentSessionId}
  B->>CF: Cashfree checkout (UPI / card / netbanking)
  CF-->>B: return to site
  CF->>API: Webhook PAYMENT_SUCCESS (signed)
  API->>API: verify signature, dedupe event
  API->>PG: tx: topup=paid, ledger credit, wallet balance += amount
  B->>API: GET /v1/store/wallet/topups/{id} (poll)
  API-->>B: status=paid, new balance
```

The browser redirect never marks a payment as paid. Only a verified webhook, or a server-side status check against Cashfree, does. See [Payments](07-payments-cashfree.md).

### 4. Nightly cutoff job

```mermaid
sequenceDiagram
  participant Q as BullMQ (22:00 IST)
  participant W as Worker
  participant PG as Postgres
  participant N as Notifications
  Q->>W: cutoff {date: tomorrow, slot: morning}
  W->>PG: advisory lock (date, slot)
  W->>PG: expand active subscriptions for date (pauses, overrides, patterns)
  W->>PG: add confirmed one-time orders for date + slot
  W->>PG: upsert deliveries (unique customer+date+slot)
  W->>PG: debit wallets (ledger rows keyed by delivery) or mark skipped_low_balance
  W->>PG: allocate stock FEFO, write reservations
  W->>PG: assign routes and stop order, build production plan
  W->>PG: mark cutoff run complete
  W->>N: "Tomorrow: 1 L toned milk, ₹64 debited, balance ₹420"
```

Full rules: [Business rules → Cutoff job](06-business-rules.md#cutoff-job).

### 5. Agent delivery with poor network

```mermaid
sequenceDiagram
  participant P as Agent PWA
  participant IDB as IndexedDB (on phone)
  participant API as Fastify
  P->>API: GET /v1/agent/runs/today (before leaving, on Wi-Fi)
  API-->>P: run + ordered stops
  P->>IDB: store run
  Note over P: no network on the route
  P->>IDB: queue event {clientEventId, stopId, delivered, bottles: 2, at}
  Note over P: network returns
  P->>API: POST /v1/agent/sync [queued events]
  API->>API: apply each event once (clientEventId is unique)
  API-->>P: results per event
  P->>IDB: clear applied events
```

## Cross-cutting decisions

| Concern | Decision |
|---|---|
| Time | Store timestamps in UTC (`timestamptz`). Business dates are `date` columns in IST. Cutoffs are computed in `Asia/Kolkata`. |
| Money | Integer paise everywhere: database, API, client. Format only for display. |
| IDs | Prefixed, sortable IDs: `cus_01JD…`, `ord_01JD…` (UUIDv7 encoded). Prefix tells you the type when reading logs. |
| Caching | Cloudflare for public pages and media; Valkey for hot API reads (catalog, zones, settings) with explicit invalidation on admin writes. |
| Consistency | Wallet, stock and order changes happen in one database transaction with row locks. No distributed transactions. |
| Observability | Every request gets a `requestId` (returned in the `X-Request-Id` header and in error bodies). Logs are structured JSON (Pino). |
| Config | 12-factor: everything from environment variables, validated at start-up. The process refuses to start with invalid config. |
