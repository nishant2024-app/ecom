# 14 · Go-live checklist

You don't need to write any code. The owner only provides **accounts, keys and business details**. Everything else (product photos, prices, stock, home page text) is managed later in the admin panel.

## 1. What you need to provide

| # | Item | Where to get it | Goes into |
|---|---|---|---|
| 1 | **Domain** (e.g. `example.in`) | Any registrar, ~₹700–1,200/year. Point its nameservers to Cloudflare (free plan) | Cloudflare DNS |
| 2 | **Server** | Oracle Cloud Always Free (Ampere VM), or any VPS with 2 vCPU / 8 GB. See [Infrastructure](03-infrastructure.md) | — |
| 3 | **Database password** | Pick strong passwords for the `app` and `migrator` Postgres users (Postgres runs in Docker on the server) | `DATABASE_URL`, `DATABASE_MIGRATOR_URL` |
| 4 | **Google sign-in client ID** | Google Cloud Console → APIs & Services → Credentials → OAuth client ID → *Web application*. Authorised JavaScript origins: `https://example.in`, `https://admin.example.in` | `GOOGLE_WEB_CLIENT_ID` |
| 5 | **Cashfree keys** | Cashfree Merchant Dashboard → Developers → API keys (test keys first, then production after KYC approval) | `CASHFREE_APP_ID`, `CASHFREE_SECRET_KEY`, `CASHFREE_ENV` |
| 6 | **Cashfree webhook** | Dashboard → Developers → Webhooks → add `https://api.example.in/v1/webhooks/cashfree` (payment and refund events) | — |
| 7 | **Cloudflare R2 bucket** for photos | Cloudflare → R2 → create bucket `dairy-media`; Settings → connect custom domain `media.example.in`; R2 → Manage API tokens → *Object Read & Write* for that bucket | `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_MEDIA`, `R2_PUBLIC_BASE_URL=https://media.example.in` |
| 8 | **Cloudflare Tunnel token** | Cloudflare Zero Trust → Networks → Tunnels → create; route `example.in` → `http://web:3000`, `api.example.in` → `http://api:4000` | `CLOUDFLARE_TUNNEL_TOKEN` |
| 9 | **Owner's Google email** | The Gmail/Workspace account that will run the admin | `SEED_OWNER_EMAIL` |
| 10 | **Business details** | Legal name, registered address, FSSAI licence number, support phone and email | `SEED_LEGAL_NAME`, `SEED_STORE_ADDRESS`, `SEED_FSSAI_NUMBER`, `SEED_SUPPORT_PHONE`, `SEED_SUPPORT_EMAIL` |

Generated for you, not provided: the login signing keys (`pnpm --filter @dairy/api keys:generate` prints `JWT_PRIVATE_KEYS`).

The API refuses to start in production if Google, the signing keys, Cashfree or R2 settings are missing, so a half-configured server can't take orders by accident.

## 2. Environment files on the server

`/opt/dairy/.env.app` (API and worker): copy `.env.example`, then set at least:

```
NODE_ENV=production
APP_ENV=production
PUBLIC_WEB_URL=https://example.in
PUBLIC_API_URL=https://api.example.in
CORS_ORIGINS=https://example.in,https://admin.example.in
COOKIE_DOMAIN=.example.in
DATABASE_URL=postgres://app:<password>@<data-vm>:5432/dairy
DATABASE_MIGRATOR_URL=postgres://migrator:<password>@<data-vm>:5432/dairy
VALKEY_URL=redis://<data-vm>:6379/0
GOOGLE_WEB_CLIENT_ID=…
JWT_PRIVATE_KEYS=…
CASHFREE_ENV=production
CASHFREE_APP_ID=…
CASHFREE_SECRET_KEY=…
R2_ACCOUNT_ID=…  R2_ACCESS_KEY_ID=…  R2_SECRET_ACCESS_KEY=…
R2_BUCKET_MEDIA=dairy-media
R2_PUBLIC_BASE_URL=https://media.example.in
SEED_OWNER_EMAIL=…  SEED_LEGAL_NAME=…  SEED_STORE_ADDRESS=…  SEED_FSSAI_NUMBER=…
SEED_SUPPORT_PHONE=…  SEED_SUPPORT_EMAIL=…
```

`/opt/dairy/.env.web` (storefront):

```
SITE_URL=https://example.in
SITE_NAME=Your Brand
SITE_NOINDEX=false        # true on staging
```

Admin SPA build: `VITE_API_URL=https://api.example.in pnpm --filter @dairy/admin build`, then deploy `apps/admin/dist` to Cloudflare Pages at `admin.example.in` behind Cloudflare Access.

> **Simplest path:** follow [Put the shop live on one server](17-deploy-single-server.md) (one VPS, `infra/compose/single.yml`, nightly backups). The two-server layout below is for later.

## 3. First deploy

```bash
docker compose -f infra/compose/data.yml up -d                 # on the data VM
docker compose -f infra/compose/app.yml up -d --build          # runs migrations, then api ×2, worker, web, tunnel
docker compose -f infra/compose/app.yml run --rm migrate pnpm seed  # first time only
```

The seed only runs on an empty database. In production it creates (`SEED_CATALOG=draft`, the default):

- the store, categories and shipping zones (Pune, Maharashtra & Goa, rest of India, remote areas);
- **12 sample products as hidden drafts with no stock**, so you can edit them instead of typing everything from scratch. Use `SEED_CATALOG=none` to start empty;
- the Owner account for `SEED_OWNER_EMAIL`.

No sample customers, orders or stock are created in production.

## 4. Set up the shop in the admin (no code)

Sign in at `https://admin.example.in` with the owner's Google account.

1. **Settings → Shipping zones**: check fees, free-shipping amounts and delivery days.
2. **Settings → Team**: invite staff by Google email with a role (warehouse, support, content, accountant…).
3. **Categories**: rename, reorder or add categories.
4. **Products**: for each product, fix the name, price, MRP, HSN and GST rate (confirm with your CA), then **upload photos** (drag and drop; they're resized automatically). The first photo is the main image. Set status to **Active** when it's ready.
5. **Inventory → Record batch**: enter each production batch with its code, manufacturing and expiry dates and quantity. Products only sell when they have stock.
6. **Storefront**: edit the announcement bar, home page headline, the photo at the top, the "our story" text and photo, the four promises, and the Google title and description.

## 5. Test before announcing

- [ ] With `CASHFREE_ENV=sandbox` and test keys: place an order, pay with a Cashfree test card or UPI, confirm the order shows **Paid** in the admin.
- [ ] Cancel a paid test order from the customer's account: refund shows in Cashfree and on the order.
- [ ] Pack, print a packing slip, ship (enter courier and AWB) and mark delivered in the admin.
- [ ] Open `https://example.in/sitemap.xml` and `/robots.txt`; submit the sitemap in Google Search Console.
- [ ] Share a product link on WhatsApp and check the preview.
- [ ] Switch to production Cashfree keys and make one real ₹1–10 purchase, then refund it.

Cashfree reviews your site before activating live payments. These pages already exist and are linked in the footer: **/terms, /privacy, /refunds, /shipping-policy, /contact**. Have a lawyer or CA review their wording for your business.

## 6. What is not automated yet

Be clear about these before launch:

| Area | Today | Planned |
|---|---|---|
| Order emails and push notifications | Customers see status on their order page; no emails are sent yet | Brevo/Resend emails and FCM push (variables are reserved in `.env.example`) |
| Courier booking | Staff book the courier themselves (Shiprocket, Delhivery, India Post) and type the AWB number into the admin | Shiprocket API integration |
| GST invoices | Prices include GST and HSN/GST rate are stored per product; no invoice PDF yet | Invoice PDF per order |
| Discount codes | Not available | Coupons |
| Cash on delivery | Not offered (prepaid only, by design) | — |
