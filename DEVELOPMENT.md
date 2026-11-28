# Development guide

Everything a new developer needs to run, change, test and extend the project. For how the pieces fit together read [ARCHITECTURE.md](ARCHITECTURE.md) first; to put it on a server read [DEPLOYMENT.md](DEPLOYMENT.md).

## Prerequisites

| Tool    | Version                           | Notes                                                                                                     |
| ------- | --------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Node.js | 22.12 or newer (`.nvmrc` says 24) | `node -v`                                                                                                 |
| pnpm    | 10 (pinned in `package.json`)     | `corepack enable` installs the right one                                                                  |
| Docker  | recent, running                   | Only for the local Postgres, Valkey and mail catcher. You can use your own Postgres 16/17 + Redis instead |
| git     | any                               |                                                                                                           |

## First run

The setup scripts check the tools, create `.env`, start the database, install, migrate and seed sample data.

```bash
git clone https://github.com/nishant2024-app/ecom.git && cd ecom
./scripts/local-setup.sh you@gmail.com        # macOS, Linux, WSL
scripts\local-setup.cmd you@gmail.com         # Windows (Command Prompt or PowerShell)
pnpm dev
```

`you@gmail.com` becomes the Owner account in the admin. By hand, the same thing is:

```bash
corepack enable
pnpm install
cp .env.example .env                           # then set AUTH_TEST_MODE=true to skip Google while developing
docker compose -f infra/compose/dev.yml up -d  # Postgres 17 (roles app + migrator), Valkey, Mailpit
pnpm db:migrate
pnpm db:seed                                   # sample products, batches, zones, a coupon (SEED_CATALOG=demo)
pnpm dev
```

| What                             | Address                                                                                        |
| -------------------------------- | ---------------------------------------------------------------------------------------------- |
| Shop                             | http://localhost:3000                                                                          |
| Admin                            | http://localhost:5173 (with `AUTH_TEST_MODE=true` it shows a "Local testing" email box)        |
| API reference (development only) | http://localhost:4000/docs                                                                     |
| Caught emails                    | http://localhost:8025 (Mailpit; set `EMAIL_PROVIDER=log` to print them in the API log instead) |

In development with no Cashfree keys, a fake payment page ("Pay with test UPI") stands in for Cashfree, so you can place and pay for orders without any account.

`pnpm dev` runs the API, shop and admin together through `scripts/dev.mjs` (Ctrl+C stops all). Run just one with `pnpm dev api`, `pnpm dev shop` or `pnpm dev admin`. The worker (expires unpaid orders, sends emails) is separate: `pnpm --filter @dairy/api worker`.

**Google Cloud Shell / Codespaces:** open the shop and admin through the port preview URLs. The admin calls `/api` on its own address and Vite forwards it, so sign-in works through the preview. Cloud Shell has little memory: if a process is killed ("exit 137"), start one part per tab with `pnpm dev api`, `pnpm dev shop`, `pnpm dev admin`.

## Repository layout

```
apps/
  api/src/
    routes/{store,admin}/   one file per area; routes/auth.ts, webhooks.ts, dev.ts (development-only helpers)
    services/               orchestration: orders, quote, payments, email, storage, images, geocoder, coupons
    plugins/                auth + permissions, idempotency
    lib/                    errors (problem+json), audit log, shared schemas
    config.ts               every environment variable, validated at start-up
    app.ts                  builds the Fastify app; server.ts and worker.ts start it
    test/                   integration tests on a real Postgres
  web/src/{app,components,lib}   Next.js storefront
  admin/src/{pages,components,lib}   Vite + React admin
  video/                    Remotion compositions (optional)
packages/
  core/    pure rules + unit tests (no I/O)
  db/      src/schema.ts, drizzle/ (SQL migrations), scripts/{migrate,seed,reset}.ts
  ui/      tokens.css, theme.css, fonts.css, PackShot, contrast checker
infra/     compose/{dev,single}.yml, nginx/, cloudflared/ notes
scripts/   dev.mjs, local-setup.*, deploy.sh, backup.sh, restore.sh
docs/      topic documentation, docs/api (OpenAPI + guides)
```

## Everyday commands

| Command                                                     | What it does                                                                |
| ----------------------------------------------------------- | --------------------------------------------------------------------------- |
| `pnpm dev`                                                  | API + shop + admin with live reload                                         |
| `pnpm build`                                                | Production build of everything (Turborepo caches)                           |
| `pnpm typecheck`                                            | TypeScript across all packages                                              |
| `pnpm lint`                                                 | ESLint (typescript-eslint, react-hooks)                                     |
| `pnpm format` / `pnpm format:check`                         | Prettier write / check (code style: single quotes, 200 columns)             |
| `pnpm test`                                                 | Unit tests (core) and API integration tests                                 |
| `pnpm --filter @dairy/core test`                            | Only the pure-rule tests (fast, no database)                                |
| `pnpm --filter @dairy/api test`                             | API tests; need Postgres, see below                                         |
| `pnpm --filter @dairy/ui contrast`                          | WCAG contrast of every design-token pair, light and dark                    |
| `pnpm db:generate`                                          | Create a migration from changes to `packages/db/src/schema.ts`              |
| `pnpm db:migrate` / `pnpm db:seed`                          | Apply migrations / seed an empty database                                   |
| `pnpm --filter @dairy/db reset`                             | Wipe the **development** database, migrate and seed again                   |
| `pnpm --filter @dairy/api spec ../../docs/api/openapi.json` | Regenerate the OpenAPI file after changing routes (CI fails if it is stale) |
| `pnpm docs:api`                                             | Rebuild `docs/api/reference.html` from the OpenAPI file                     |
| `pnpm --filter @dairy/api keys:generate`                    | Print a new `JWT_PRIVATE_KEYS` value                                        |
| `pnpm --filter @dairy/video render`                         | Render the optional pantry reel to `apps/video/out/`                        |

## Testing

- **Core** (`packages/core/test`): Vitest plus fast-check property tests for money, dates, ids, shipping zones, order states, GST, FEFO, quantity, geo and discounts. No database.
- **API** (`apps/api/test`): integration tests that build the real app against a real PostgreSQL database named `dairy_test`: sign-in and permissions, catalogue, checkout and orders, mock and Cashfree payments (stubbed HTTP), webhooks, expiry, photos, coupons, emails, reviews. The test setup migrates the database itself. The local Docker Postgres creates `dairy_test` for you (`infra/compose/init-dev.sql`). To use your own server, create a `migrator` and an `app` role and a database, then set `TEST_DATABASE_URL` and `TEST_DATABASE_MIGRATOR_URL` (see `.env.example`).
- **Contrast** (`pnpm --filter @dairy/ui contrast`): fails if a token pair drops below WCAG AA.
- **CI** (`.github/workflows/ci.yml`) runs lint, format check, typecheck, the tests, contrast, the OpenAPI freshness check and the production builds on every pull request.

Google sign-in is tested with a locally generated key set that goes through the same checks as production (issuer, audience, expiry, nonce, verified email).

## Conventions

- **TypeScript strict.** No `any` without a reason; ESLint warns on it.
- **Business rules belong in `packages/core`** as pure functions with unit tests. Route handlers stay thin and call a service.
- **Money** is integer paise. Never use floats for prices. **Dates** use `packages/core/src/time.ts` (IST); never derive a business date from `toISOString()`.
- **Ids** come from `newId('prefix')` (`packages/core/src/ids.ts`); add a prefix there when you add a table.
- **Errors:** throw `AppError(code, status, detail)`; the error handler turns it into `application/problem+json`. List new codes in `docs/api/README.md`.
- **Validation:** every route declares TypeBox schemas for params, query, body and responses. That is also what generates the OpenAPI file.
- **Database:** use transactions for anything touching orders, stock or payments, lock rows with `FOR UPDATE`, and avoid per-row queries in list endpoints (use joins or one grouped query).
- **Migrations:** never edit an applied migration; change `schema.ts`, run `pnpm db:generate`, review the SQL and commit it. Keep migrations backward compatible (add first, remove later) so a deploy can roll back.
- **Logging:** Pino. Authorization headers and cookies are redacted; never log tokens, payment payloads or full addresses.
- **UI:** use design tokens only (Tailwind's default colours are removed). Follow [docs/08-design-system.md](docs/08-design-system.md). Check the shop at phone width, in dark mode, and with the keyboard before opening a pull request.
- **Images:** only the owner's own photos, uploaded in the admin. Until a product has photos the drawn `PackShot` is shown. Do not add stock or generated images.
- **Research first:** before building a new feature or page, study the competitors and record it in `docs/` (see `CLAUDE.md`).

## Adding things

**An API endpoint:** create or extend a file in `apps/api/src/routes/store` or `admin`, give it `config: { auth: 'public' | 'customer' | 'staff', permission: '…' }` and TypeBox schemas, register it in `app.ts`, add an integration test, run the `spec` command above and commit `docs/api/openapi.json`.

**A table or column:** edit `packages/db/src/schema.ts`, `pnpm db:generate`, `pnpm db:migrate`, update the seed if sample data helps, and add tests.

**A setting:** add it to the schema in `apps/api/src/config.ts` (with a default or a production check), then document it in `.env.example` and `.env.production.example`.

**An admin page:** add `apps/admin/src/pages/X.tsx`, add it to the menu and routes in `apps/admin/src/App.tsx`, and gate the menu entry with a permission. Lists use the shared `DataTable` (`apps/admin/src/components/DataTable.tsx`, a themed wrapper around [Tabulator](https://tabulator.info)): define the columns once (`useMemo`), build cells with the helpers in `components/cells.ts` (they use DOM nodes, never HTML strings, so data cannot inject markup), give every row a real link or button for keyboard users, memoize the `data` array so the table only re-renders when the data changes, and keep the phone card layout (`md:hidden`) beside the table. Row action menus use `FloatingMenu`; destructive actions use `ConfirmDialog`.

## Troubleshooting

| Symptom                                                | Fix                                                                                                                                            |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `ECONNREFUSED 5432` or health check 503                | Postgres/Valkey are not running: `docker compose -f infra/compose/dev.yml up -d`                                                               |
| `role "app" does not exist`                            | The database was created without the dev init script. `docker compose -f infra/compose/dev.yml down -v` then `up -d` (this deletes local data) |
| `Port 3000/4000/5173 is already in use`                | An old `pnpm dev` is still running. Stop it                                                                                                    |
| Sign-in shows no Google button                         | `GOOGLE_WEB_CLIENT_ID` is empty. Use `AUTH_TEST_MODE=true` locally                                                                             |
| `Invalid configuration: …` when the API starts         | The message names the variable; fix it in `.env`                                                                                               |
| Tests fail with `database "dairy_test" does not exist` | Recreate the dev Postgres volume (see above) or create the database yourself                                                                   |
| Process killed, exit 137                               | Out of memory: run one app at a time                                                                                                           |
| Address lookup does nothing in a restricted network    | Node's `fetch` ignores HTTP proxies by default; set `NODE_USE_ENV_PROXY=1` or `GEOCODER_URL=off`                                               |
