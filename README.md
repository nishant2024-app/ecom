# Dairy store

Online dairy store for India: daily milk subscriptions, one-time orders, a prepaid wallet with Cashfree payments, delivery operations, and a full admin panel. One Fastify API serves the website, the admin, the delivery agent app and a future Android app. Runs on free-tier infrastructure.

**Status:** planning and documentation. No application code yet.

| | |
|---|---|
| Roadmap | [PLAN.md](PLAN.md) |
| Documentation | [docs/README.md](docs/README.md) |
| API guide | [docs/api/README.md](docs/api/README.md) |
| OpenAPI contract | [docs/api/openapi.yaml](docs/api/openapi.yaml) |
| Design system | [docs/08-design-system.md](docs/08-design-system.md) |
| Decisions | [docs/adr/](docs/adr/) |

## Stack at a glance

Fastify 5 · PostgreSQL 17 + PostGIS · Valkey + BullMQ · Next.js storefront · Vite React admin and agent apps · Tailwind v4 with custom tokens · Remotion · Cashfree · Google Sign-In · Docker on Oracle Cloud Always Free · Cloudflare (CDN, Tunnel, Pages, Access, R2)

## Working on the docs

```bash
# lint the OpenAPI contract and rebuild the rendered reference
npx @redocly/cli@1.34.5 lint docs/api/openapi.yaml --config docs/api/redocly.yaml
npx @redocly/cli@1.34.5 build-docs docs/api/openapi.yaml --config docs/api/redocly.yaml -o docs/api/reference.html
```
