# Documentation

Documentation for the dairy e-commerce platform: storefront, admin panel, delivery agent app, public API and the infrastructure it runs on.

> **Status:** design documentation, written before implementation. Where a document describes behaviour, that behaviour is the contract the code must meet. When code and docs disagree, fix one of them in the same pull request.

## Start here

| If you are… | Read |
|---|---|
| New to the project | [Overview](01-overview.md) → [Architecture](02-architecture.md) → [Development guide](12-development.md) |
| Building the Android app | [Android integration](13-android-integration.md) → [API guide](api/README.md) → [OpenAPI spec](api/openapi.yaml) |
| Building a UI | [Design system](08-design-system.md) |
| Running the servers | [Infrastructure](03-infrastructure.md) → [Operations & runbooks](11-operations.md) |
| Reviewing security | [Authentication](04-authentication.md) → [Security & privacy](10-security-privacy.md) |

## Contents

| # | Document | What it covers |
|---|---|---|
| 01 | [Overview](01-overview.md) | Product scope, users, glossary of dairy and business terms |
| 02 | [Architecture](02-architecture.md) | Components, request flows, sequence diagrams |
| 03 | [Infrastructure](03-infrastructure.md) | Hosting, domains, environments, deploy pipeline, costs, hosting options compared |
| 04 | [Authentication](04-authentication.md) | Google Sign-In for customers, staff and agents; tokens, sessions, roles |
| 05 | [Data model](05-data-model.md) | Tables, relationships, conventions |
| 06 | [Business rules](06-business-rules.md) | Subscriptions, cutoff job, wallet, deliveries, GST, stock, bottles, refunds |
| 07 | [Payments (Cashfree)](07-payments-cashfree.md) | Orders, top-ups, UPI Autopay, webhooks, refunds, reconciliation |
| 08 | [Design system](08-design-system.md) | "Milk Card" direction, tokens, type, components, motion, voice, anti-slop checklist |
| 09 | [Video (Remotion)](09-video.md) | Video templates, rendering pipeline, licensing |
| 10 | [Security & privacy](10-security-privacy.md) | Threat model, controls, DPDP Act, data retention |
| 11 | [Operations & runbooks](11-operations.md) | Monitoring, alerts, backups, deploys, incident runbooks |
| 12 | [Development guide](12-development.md) | Local setup, repo layout, environment variables, standards, testing, git workflow |
| 13 | [Android integration](13-android-integration.md) | Using the API from the future Android app |

### API

| Document | What it covers |
|---|---|
| [API guide](api/README.md) | Conventions: versioning, auth, errors, pagination, idempotency, rate limits, money and dates |
| [Auth & meta endpoints](api/auth.md) | Sign-in, refresh, sessions, app config, health |
| [Store endpoints](api/store.md) | Customer-facing: catalog, cart, orders, subscriptions, wallet, deliveries |
| [Agent endpoints](api/agent.md) | Delivery agent app: runs, stops, offline sync |
| [Admin endpoints](api/admin.md) | Staff panel: catalog, dispatch, inventory, customers, reports, settings |
| [Webhooks](api/webhooks.md) | Inbound Cashfree webhooks |
| [OpenAPI 3.1 spec](api/openapi.yaml) | Machine-readable contract; generate clients from it |
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

Roadmap and phases: [PLAN.md](../PLAN.md).

## Writing these docs

- Plain English, short sentences. Write for a new developer who joined today.
- Diagrams use Mermaid so they render on GitHub and stay editable as text.
- Placeholders: `example.in` stands for the real domain. Replace it everywhere once the domain is bought.
- New significant decision → new ADR in `docs/adr/` using the same format.
