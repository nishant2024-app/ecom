# 12 · Development guide

## Prerequisites

| Tool | Version |
|---|---|
| Node.js | 24 LTS (`.nvmrc`) |
| pnpm | 10 (`corepack enable`) |
| Docker + Docker Compose | Recent stable |
| Git | Any recent |
| Optional: `cloudflared` | For testing webhooks locally |

## First run

Shortcut: `./scripts/local-setup.sh you@gmail.com` does everything below (checks tools, creates `.env`, starts Docker, installs, migrates, seeds). Then run `pnpm dev`. The admin has a "Local testing" email box when `AUTH_TEST_MODE=true`.

Step by step:

```bash
git clone https://github.com/nishant2024-app/ecom.git
cd ecom
corepack enable
pnpm install
cp .env.example .env            # set AUTH_TEST_MODE=true to try without Google; add keys when you have them
docker compose -f infra/compose/dev.yml up -d   # postgres, valkey, mailpit
pnpm db:migrate
pnpm db:seed                    # 12 products with batches, shipping zones, a demo customer and sample orders
pnpm dev                        # api :4000, web :3000, admin :5173
```

- API docs (Scalar): http://localhost:4000/docs
- Emails are caught by Mailpit: http://localhost:8025
- Seed staff: sign in to the admin with the Google account in `SEED_OWNER_EMAIL`.
- Customers without Google: `AUTH_TEST_MODE=true` shows a test sign-in on `/signin`; with no Cashfree keys a test payment page stands in for Cashfree.

## Repository layout

```
apps/
  api/        Fastify API + workers
    src/
      routes/{auth,store,admin}/, webhooks.ts, dev.ts
      services/        orchestration (DB + core + external)
      plugins/         auth, permissions, idempotency, rate limit, errors
      config.ts        env schema (fails fast)
    test/
  web/        Next.js storefront
  admin/      Vite React admin
  video/      Remotion compositions + render script
packages/
  core/       pure domain logic (no I/O)
  db/         Drizzle schema, migrations, seed
  ui/         tokens, fonts, PackShot, primitives
  emails/     React Email templates
  config/     tsconfig, eslint, tailwind preset
infra/        tofu, ansible, compose, runbooks scripts
docs/         this documentation
```

## Common commands

| Command | Does |
|---|---|
| `pnpm dev` | Run all apps in watch mode |
| `pnpm --filter api dev` | Run one app |
| `pnpm build` | Build everything (Turborepo caches) |
| `pnpm lint` / `pnpm typecheck` | ESLint / TypeScript |
| `pnpm test` | Unit tests (Vitest) |
| `pnpm test:integration` | API tests against Docker Postgres |
| `pnpm test:e2e` | Playwright (`--trace off` by default) |
| `pnpm db:generate` | Create a migration from schema changes |
| `pnpm db:migrate` | Apply migrations |
| `pnpm db:seed` | Seed local data |
| `pnpm --filter @dairy/api spec ../../docs/api/openapi.json` | Regenerate the OpenAPI spec from the routes |
| `pnpm docs:api` | Rebuild `docs/api/reference.html` from the spec |
| `pnpm ui:contrast` | Check token colour contrast |
| `pnpm --filter @dairy/api worker` | Run the order-expiry worker |
| `pnpm --filter @dairy/video render` | Render the Remotion pantry reel into the storefront |

## Environment variables

All variables are validated at start-up (`apps/api/src/config.ts`); the process exits with a clear message if something is missing or wrong. `.env.example` lists every variable with a comment. Never commit `.env`.

| Variable | Example | Used by |
|---|---|---|
| `NODE_ENV` | `development` | all |
| `APP_ENV` | `local` · `staging` · `production` | all |
| `API_PORT` | `4000` | api |
| `PUBLIC_WEB_URL` | `http://localhost:3000` | api, web |
| `PUBLIC_API_URL` | `http://localhost:4000` | web, admin |
| `CORS_ORIGINS` | `http://localhost:3000,http://localhost:5173,http://localhost:5174` | api |
| `COOKIE_DOMAIN` | `localhost` / `.example.in` | api |
| `DATABASE_URL` | `postgres://app:app@localhost:5432/dairy` | api, worker |
| `DATABASE_MIGRATOR_URL` | `postgres://migrator:…@localhost:5432/dairy` | migrations |
| `VALKEY_URL` | `redis://localhost:6379/0` | api, worker |
| `GOOGLE_WEB_CLIENT_ID` | `1234-abc.apps.googleusercontent.com` | api, web, admin |
| `AUTH_TEST_MODE` | `true` locally only | api |
| `JWT_PRIVATE_KEYS` | JSON array of `{kid, pem}` Ed25519 keys; first signs | api |
| `CASHFREE_ENV` | `sandbox` · `production` | api |
| `CASHFREE_APP_ID` | — | api |
| `CASHFREE_SECRET_KEY` | — | api |
| `CASHFREE_API_VERSION` | pinned version string | api |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_MEDIA`, `R2_PUBLIC_BASE_URL` | — | api, worker |
| `FCM_SERVICE_ACCOUNT_JSON` | base64 JSON | worker |
| `WEB_PUSH_VAPID_PUBLIC`, `WEB_PUSH_VAPID_PRIVATE` | — | worker, web |
| `BREVO_API_KEY`, `RESEND_API_KEY`, `MAIL_FROM` | — | worker |
| `SENTRY_DSN` | — | all |
| `TOTP_ENCRYPTION_KEY` | 32-byte base64 | api |
| `SEED_OWNER_EMAIL` | your Google email | seed |

## Coding standards

- **TypeScript strict** everywhere. No `any` without a comment explaining why.
- **Business rules go in `packages/core`** as pure functions with unit tests. Route handlers stay short.
- **Money:** integer paise, `Money` type from `packages/core/money.ts`; no arithmetic on floats; one helper converts to Cashfree's rupee decimals.
- **Dates:** use `packages/core/time.ts` (`todayIST()`, `addDays()`, all in IST). Never derive business dates from `toISOString()`.
- **IDs:** `newId('cus')` from `packages/core/id.ts`.
- **Errors:** throw `AppError(code, status, detail)`; the error plugin turns it into problem+json. Add new codes to the table in `docs/api/README.md`.
- **Validation:** every route declares TypeBox schemas for params, query, body and each response.
- **Database:** transactions for anything touching payments, stock or orders; lock rows with `FOR UPDATE`; no N+1 queries in lists (use joins or batch loads).
- **Logging:** Pino structured logs; never log tokens, full phone numbers, addresses or payment payloads (redaction list in `plugins/logger.ts`).
- **Formatting:** Prettier; ESLint with `typescript-eslint` strict; imports sorted.
- **UI:** only design tokens; follow the [design system](08-design-system.md) and its checklist.

## Testing

| Layer | Tool | Scope | Runs |
|---|---|---|---|
| Unit | Vitest + fast-check | `packages/core`: shipping zones, order states, GST, FEFO, pricing, money, dates | Every PR |
| Integration | Vitest + Postgres | Auth, permissions, catalog, quotes, orders, stock reservation, mock and Cashfree payments (stubbed HTTP), webhooks, expiry, admin fulfilment and catalog | Every PR |
| Contract | spec regeneration | Generated OpenAPI must match `docs/api/openapi.json` | Every PR |
| End-to-end | Playwright | Storefront: test sign-in, add to basket, checkout, test payment, order page; admin: pack and ship | Before release (scripted today; CI job next) |
| Accessibility | axe-core in Playwright | Every page, light and dark | Every PR |
| Visual | Playwright screenshots | Key components and pages, en + hi, light + dark | Every PR |
| Performance | Lighthouse CI | Budgets in [design system](08-design-system.md#performance-design-constraints) | Every PR to `main` |
| Load | k6 | 500 req/s mix on staging | Before launch, then monthly |

Google sign-in in tests: the test app verifies ID tokens against a locally generated key set with exactly the same checks as production (issuer, audience, expiry, nonce, email verified).

## Git workflow

- `main` is always deployable; protected; requires passing CI and one review.
- Branch per change: `feat/courier-awb`, `fix/quote-weight`, `docs/api-orders`.
- **Conventional Commits:** `feat(api): add Shiprocket AWB creation`, `fix(web): cart drawer focus order`.
- Small pull requests (< 400 changed lines where possible). Include tests and docs updates in the same PR.
- Release: tag `vYYYY.MM.DD-N` on `main` → production deploy.

## Pull request checklist

- [ ] Tests added or updated; `pnpm test` and `pnpm test:integration` pass
- [ ] API changes reflected in `docs/api/*.md` and the regenerated `openapi.json`; no breaking change to `/v1`
- [ ] Migrations are backward compatible (expand/contract)
- [ ] No secrets, tokens or personal data in code, logs or fixtures
- [ ] UI changes pass the [anti-slop checklist](08-design-system.md#anti-slop-checklist-every-ui-pull-request)
- [ ] Screenshots for UI changes (mobile 360px + desktop, en + hi)
- [ ] Docs updated if behaviour changed

## Definition of done

A feature is done when it is merged, deployed to staging, covered by tests, documented, observable (logs/metrics for failures), accessible, and the owner has seen it working.
