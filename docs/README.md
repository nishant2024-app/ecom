# Documentation

Documentation for the Mulshi Dairy shop: storefront, admin panel, public API, video and the infrastructure they run on.

> These docs describe the code as built. When code and docs disagree, fix one of them in the same pull request. The API reference is generated from the code.

## Start here

| If you are… | Read |
|---|---|
| New to the project | [Overview](01-overview.md) → [Architecture](02-architecture.md) → [Development guide](12-development.md) |
| Launching the shop | [Go-live checklist](14-go-live.md) → [Deploy on one server](17-deploy-single-server.md) |
| Building the Android app | [Android integration](13-android-integration.md) → [API guide](api/README.md) → [OpenAPI spec](api/openapi.json) |
| Building a UI | [Design system](08-design-system.md) |
| Running the servers | [Infrastructure](03-infrastructure.md) → [Operations & runbooks](11-operations.md) |
| Reviewing security | [Authentication](04-authentication.md) → [Security & privacy](10-security-privacy.md) |

## Contents

| # | Document | What it covers |
|---|---|---|
| 01 | [Overview](01-overview.md) | Product scope, users, glossary |
| 02 | [Architecture](02-architecture.md) | Components, request flows, sequence diagrams |
| 03 | [Infrastructure](03-infrastructure.md) | Hosting, domains, environments, deploy pipeline, costs, hosting options compared |
| 04 | [Authentication](04-authentication.md) | Google Sign-In for customers and staff; tokens, sessions, roles |
| 05 | [Data model](05-data-model.md) | Tables, relationships, conventions |
| 06 | [Business rules](06-business-rules.md) | Stock and batches, shipping zones, quotes, order lifecycle, cancellations, GST |
| 07 | [Payments (Cashfree)](07-payments-cashfree.md) | Order payments, mock provider, webhooks, missed-webhook recovery, refunds |
| 08 | [Design system](08-design-system.md) | "Pasture & Pantry": tokens, PackShot illustrations, animated components, motion rules, checklist |
| 09 | [Video (Remotion)](09-video.md) | Pantry and product reels, local rendering, licensing |
| 10 | [Security & privacy](10-security-privacy.md) | Threat model, controls, DPDP Act, data retention |
| 11 | [Operations & runbooks](11-operations.md) | Monitoring, alerts, backups, deploys, incident runbooks |
| 12 | [Development guide](12-development.md) | Local setup, repo layout, environment variables, standards, testing, git workflow |
| 13 | [Android integration](13-android-integration.md) | Using the API from the future Android app |
| 19 | [Coupons](19-coupons.md) | Discount codes: rules, GST and shipping effects, API |
| 18 | [Order emails](18-order-emails.md) | Confirmed / shipped / delivered / cancelled emails, queue, providers and DNS setup |
| 17 | [Put the shop live on one server](17-deploy-single-server.md) | Step-by-step server setup, tunnel, admin hosting, Cashfree, nightly backups, updates, final checks |
| 16 | [Exact delivery location](16-location-and-delivery.md) | Map pin and GPS on addresses, what couriers see, Android steps, privacy, map and lookup providers at scale |
| 15 | [Competitor research](15-competitor-research.md) | Amul, Two Brothers, Akshayakalpa and others: what they do, where we win, feature list |
| 14 | [Go-live checklist](14-go-live.md) | The keys and details the owner provides, first deploy, setting up the shop in the admin, launch tests |

### API

| Document | What it covers |
|---|---|
| [API guide](api/README.md) | Conventions: versioning, auth, errors, pagination, idempotency, rate limits, money and dates |
| [Auth & meta endpoints](api/auth.md) | Sign-in, refresh, sessions, app config, health |
| [Store endpoints](api/store.md) | Customer-facing: catalog, shipping estimate, quote, addresses, orders |
| [Admin endpoints](api/admin.md) | Dashboard, orders fulfilment, products, inventory, customers, shipping zones, staff, audit |
| [Webhooks](api/webhooks.md) | Inbound Cashfree webhooks |
| [OpenAPI 3.1 spec](api/openapi.json) | Generated from the Fastify routes (`pnpm --filter @dairy/api spec`); generate clients from it |
| [Rendered API reference](api/reference.html) | The OpenAPI spec as a browsable page (open locally in a browser) |

### Decision records

| ADR | Decision |
|---|---|
| [0001](adr/0001-fastify-api-first.md) | One Fastify REST API for web, admin and Android |
| [0002](adr/0002-self-hosted-zero-cost-infra.md) | Self-hosted on Oracle Cloud Always Free behind Cloudflare |
| [0003](adr/0003-google-only-login.md) | Google Sign-In only; no SMS OTP |
| [0004](adr/0004-hostinger-single-plan.md) | Do not use Hostinger Single shared hosting |
| [0005](adr/0005-postgres-self-hosted.md) | PostgreSQL self-hosted instead of Supabase |
| [0006](adr/0006-multi-vendor-ready-schema.md) | Multi-vendor-ready schema from day one |
| [0007](adr/0007-shelf-stable-shipped-commerce.md) | Shelf-stable products shipped by courier (replaces daily delivery) |

Roadmap and phases: [PLAN.md](../PLAN.md).

## Writing these docs

- Plain English, short sentences. Write for a new developer who joined today.
- Diagrams use Mermaid so they render on GitHub and stay editable as text.
- Placeholders: `example.in` stands for the real domain. Replace it everywhere once the domain is bought.
- New significant decision → new ADR in `docs/adr/` using the same format.
