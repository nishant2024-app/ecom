# Mulshi Dairy: Build Plan (v4)

An online shop for **shelf-stable dairy products** made on our farm: bilona ghee, milk powder, UHT and flavoured milk, condensed milk and milk sweets. Customers in India order online, pay through Cashfree, and receive the parcel by courier in 1–6 days. The owner runs everything from an admin panel. One Fastify API serves the website, the admin and a future Android app. Hosting is free-tier (Oracle Cloud Always Free behind Cloudflare).

> **What changed in v4:** the business is not daily fresh-milk delivery. It sells durable, processed dairy products shipped by courier. Subscriptions, the milk calendar, the 10 PM cutoff, delivery routes, agents and the wallet were removed. The storefront was redesigned as an animated site ([ADR 0007](docs/adr/0007-shelf-stable-shipped-commerce.md)). Detailed reference: [`docs/`](docs/README.md).

## Decisions

| # | Decision | Detail |
|---|---|---|
| 1 | Products | Shelf-stable dairy: ghee, milk powder, UHT/flavoured milk, condensed milk, mithai (21–365 day shelf life) |
| 2 | Delivery | Courier across India; fees and delivery days by pincode zone, configurable in admin |
| 3 | Payments | Cashfree, INR, prepaid only (UPI, cards, net banking). No cash on delivery yet. |
| 4 | Login | Google Sign-In only, for customers and staff. No SMS. |
| 5 | Vendors | Single brand now; schema is multi-vendor ready ([ADR 0006](docs/adr/0006-multi-vendor-ready-schema.md)) |
| 6 | Hosting | ₹0: Oracle Always Free + Cloudflare; Docker so it moves anywhere ([ADR 0002](docs/adr/0002-self-hosted-zero-cost-infra.md)) |
| 7 | API | Fastify, versioned `/v1`, OpenAPI generated from code ([ADR 0001](docs/adr/0001-fastify-api-first.md)) |
| 8 | Design | Animated "Pasture & Pantry" storefront with drawn pack illustrations until photography exists ([docs/08](docs/08-design-system.md)) |
| 9 | Video | Remotion renders brand and product reels on our own machine, no paid rendering service ([docs/09](docs/09-video.md)) |

## What's built

| Area | State |
|---|---|
| Business rules (`packages/core`): money, IST dates, shipping zones, order state machine, GST, FEFO stock, pricing | Done · 34 tests |
| Database (`packages/db`): orders, payments, refunds, batches, stock ledger, shipping zones, staff, audit | Done |
| API: Google sign-in, sessions, roles, CSRF, idempotency | Done · tested |
| API: catalog, search (Hindi/Hinglish), shipping estimate, server-priced quotes | Done · tested |
| API: orders with FEFO stock reservation, Cashfree payments + webhooks, retry, cancel + refund, auto-expiry | Done · tested |
| API: admin dashboard, orders fulfilment, products, inventory, customers, shipping zones, staff, audit log | Done · tested (29 integration tests) |
| Storefront: animated home, shop, product page, cart drawer, checkout, order tracking, account | Done · end-to-end purchase verified in a browser |
| Admin panel: dashboard, orders, products editor, inventory & batches, customers, settings | Done · fulfilment flow verified in a browser |
| Remotion: pantry reel (on the home page) and per-product reel composition | Done |
| Docker images, Compose for the two servers, CI | Written; Compose validated; images not yet built in CI |

## Next

1. **Real accounts:** Google OAuth client ID, Cashfree sandbox keys, domain, Oracle account. Then a full sandbox payment test, which pins the webhook signature format.
2. **Courier integration** (Shiprocket or Delhivery API): create shipments and fetch AWB numbers from the admin, push tracking updates.
3. **Invoices:** GST invoice PDF per order (numbering and tax maths already in `packages/core`).
4. **Emails and notifications:** order confirmed, shipped (with tracking), delivered, refund issued.
5. **Coupons** (pricing logic exists in core) and product photography upload to R2.
6. **Returns** for damaged parcels; partial refunds.
7. **Admin TOTP** for owner/admin/accountant roles.
8. **Launch hardening:** load test, security review, backups and restore drill on the real servers.
9. **Android app** on the same API (Play Console account exists).

## Costs that aren't zero

Domain (~₹700–1,200/year), Cashfree's per-transaction fee, courier charges per parcel, and a Remotion company licence if the team grows past 3 people.
