# Admin endpoints

Used by the admin panel. All endpoints need a signed-in staff member (`client: "admin"`) and the listed permission ([roles and permissions](../04-authentication.md#roles-and-permissions)). Every write is recorded in the audit log with before and after values.

Conventions: [API guide](README.md). List endpoints support cursor pagination plus `sort` (e.g. `sort=-createdAt`) and the filters shown.

## Dashboard and dispatch

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/v1/admin/dashboard` | `catalog.read` | KPIs for a date: tomorrow's volume by product, active subscriptions, wallet float, revenue, new/churned subscribers, alerts |
| GET | `/v1/admin/dispatch` | `dispatch.manage` | Dispatch board for `date` + `slotId`: cutoff status, runs, delivery counts by status |
| POST | `/v1/admin/dispatch/cutoff-runs` | `dispatch.manage` · Idempotent | Re-run the cutoff job for `{date, slotId}` (only affects undispatched deliveries) |
| GET | `/v1/admin/dispatch/cutoff-runs` | `dispatch.manage` | History of cutoff runs with stats and errors |
| GET | `/v1/admin/dispatch/packing-lists` | `dispatch.manage` | Packing list per route for `date` + `slotId`; `format=pdf` for print |
| GET | `/v1/admin/dispatch/route-sheets` | `dispatch.manage` | Route sheets; `format=pdf` |
| POST | `/v1/admin/dispatch/runs/{runId}/assign` | `dispatch.manage` | Assign an agent to a run |
| POST | `/v1/admin/dispatch/mark-packed` | `dispatch.manage` | Bulk mark deliveries of routes as packed |
| GET | `/v1/admin/production-plan` | `inventory.write` | Units to produce for `date` + `slotId` |

## Catalog

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/v1/admin/products` | `catalog.read` | List; filters `status`, `category`, `q` |
| POST | `/v1/admin/products` | `catalog.write` | Create product with variants |
| GET | `/v1/admin/products/{productId}` | `catalog.read` | Detail |
| PATCH | `/v1/admin/products/{productId}` | `catalog.write` (prices need `pricing.write`) | Update |
| POST | `/v1/admin/products/{productId}/archive` | `catalog.write` | Archive |
| POST | `/v1/admin/products/{productId}/variants` | `catalog.write` | Add variant |
| PATCH | `/v1/admin/variants/{variantId}` | `catalog.write` / `pricing.write` | Update variant |
| PUT | `/v1/admin/variants/{variantId}/availability` | `catalog.write` | Per-zone availability and daily caps |
| POST | `/v1/admin/products/{productId}/media` | `catalog.write` | Attach an uploaded image/video |
| PATCH | `/v1/admin/media/{mediaId}` | `catalog.write` | Alt text, sort order |
| DELETE | `/v1/admin/media/{mediaId}` | `catalog.write` | Remove |
| GET/POST | `/v1/admin/categories` | `catalog.read` / `catalog.write` | List / create |
| PATCH/DELETE | `/v1/admin/categories/{categoryId}` | `catalog.write` | Update / delete (only if empty) |
| POST | `/v1/admin/products/import` | `catalog.write` | CSV import (async job; returns job ID) |
| GET | `/v1/admin/products/export` | `catalog.read` | CSV export |

Price changes take effect from the next cutoff; already scheduled deliveries keep their price. The response includes `effectiveFrom`.

## Zones and delivery setup

| Method | Path | Permission | Description |
|---|---|---|---|
| GET/POST | `/v1/admin/zones` | `settings.write` | List / create zone (GeoJSON polygon + pincodes) |
| GET/PATCH | `/v1/admin/zones/{zoneId}` | `settings.write` | Detail / update |
| GET/POST | `/v1/admin/slots` | `settings.write` | Slots with times, cutoff offset and days of week |
| PATCH | `/v1/admin/slots/{slotId}` | `settings.write` | Update |
| GET/POST | `/v1/admin/holidays` | `dispatch.manage` | No-delivery dates |
| DELETE | `/v1/admin/holidays/{holidayId}` | `dispatch.manage` | Remove |
| GET/POST | `/v1/admin/routes` | `dispatch.manage` | Routes per zone |
| PATCH | `/v1/admin/routes/{routeId}` | `dispatch.manage` | Rename, default agent |
| PUT | `/v1/admin/routes/{routeId}/stops` | `dispatch.manage` | Re-order stops (full ordered list of address IDs) |
| GET/POST | `/v1/admin/agents` | `dispatch.manage` | List / invite agent by Google email |
| PATCH | `/v1/admin/agents/{agentId}` | `dispatch.manage` | Update / deactivate (revokes sessions) |

## Customers, subscriptions, orders

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/v1/admin/customers` | `customers.read` | Search by name, email, phone, pincode; filters `zone`, `hasActiveSubscription`, `lowBalance` |
| GET | `/v1/admin/customers/{customerId}` | `customers.read` | Profile, addresses, calendar, wallet, bottles, notes, tickets |
| PATCH | `/v1/admin/customers/{customerId}` | `customers.write` | Update profile, notes, tags |
| POST | `/v1/admin/customers/{customerId}/wallet/adjustments` | `wallet.adjust` · Idempotent | Credit or debit with mandatory reason (limit by role) |
| POST | `/v1/admin/customers/{customerId}/bottles/adjustments` | `customers.write` | Correct bottle balance |
| GET | `/v1/admin/subscriptions` | `customers.read` | List; filters `status`, `zone`, `product`, `slot` |
| PATCH | `/v1/admin/subscriptions/{subscriptionId}` | `customers.write` | Edit on the customer's behalf |
| POST | `/v1/admin/subscriptions/{subscriptionId}/pauses` | `customers.write` | Pause on behalf (no cutoff restriction for Ops manager+) |
| GET | `/v1/admin/orders` | `customers.read` | List; filters `status`, `date`, `paymentMethod` |
| GET | `/v1/admin/orders/{orderId}` | `customers.read` | Detail with event timeline |
| POST | `/v1/admin/orders/{orderId}/cancel` | `orders.refund` | Cancel and refund |
| POST | `/v1/admin/refunds` | `orders.refund` · Idempotent | Refund a delivery or order (wallet or source) |
| GET | `/v1/admin/deliveries` | `customers.read` | List; filters `date`, `status`, `route`, `agent` |
| PATCH | `/v1/admin/deliveries/{deliveryId}` | `dispatch.manage` | Set status manually (with reason) |
| GET | `/v1/admin/tickets` | `customers.read` | Customer-reported issues |
| PATCH | `/v1/admin/tickets/{ticketId}` | `customers.write` | Resolve, assign, reply |

### Example: wallet adjustment

```http
POST /v1/admin/customers/cus_01JD…/wallet/adjustments
Idempotency-Key: 0d2b7c1e-…
```

```json
{ "amount": { "amount": 6000, "currency": "INR" }, "direction": "credit", "reason": "Milk pouch leaked, ticket TCK-1042" }
```

`201` with the ledger entry. `403 FORBIDDEN` if above the role's limit.

## Inventory

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/v1/admin/batches` | `inventory.write` | Batches; filters `variant`, `expiringBefore`, `status` |
| POST | `/v1/admin/batches` | `inventory.write` | Record production (variant, code, mfg/expiry dates, quantity) |
| PATCH | `/v1/admin/batches/{batchId}` | `inventory.write` | Correct details |
| POST | `/v1/admin/stock/adjustments` | `inventory.write` | Adjust a batch with reason |
| POST | `/v1/admin/stock/wastage` | `inventory.write` | Record wastage with reason |
| GET | `/v1/admin/stock/movements` | `inventory.write` | Movement ledger |
| GET | `/v1/admin/stock/levels` | `inventory.write` | On hand / reserved per variant and batch |

## Payments and finance

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/v1/admin/payments` | `reports.finance` | Payments; filters `status`, `purpose`, `date` |
| GET | `/v1/admin/payments/{paymentId}` | `reports.finance` | Detail with Cashfree data |
| POST | `/v1/admin/payments/{paymentId}/recheck` | `reports.finance` | Re-query Cashfree for status |
| GET | `/v1/admin/reconciliation` | `reports.finance` | Settlement matching results by date |
| GET | `/v1/admin/wallets/summary` | `reports.finance` | Total wallet float, top-ups, charges by period |
| GET | `/v1/admin/invoices` | `reports.finance` | Invoices; `format=csv` |

## Marketing and content

| Method | Path | Permission | Description |
|---|---|---|---|
| GET/POST | `/v1/admin/coupons` | `marketing.send` | List / create |
| PATCH | `/v1/admin/coupons/{couponId}` | `marketing.send` | Update / disable |
| GET/PUT | `/v1/admin/referral-settings` | `marketing.send` | Reward amounts and rules |
| POST | `/v1/admin/notifications/campaigns` | `marketing.send` | Send push to a segment (respects opt-outs) |
| GET/PUT | `/v1/admin/home-blocks` | `content.write` | Home page blocks (ordered list) |
| GET/POST | `/v1/admin/banners` | `content.write` | Banners |
| GET/POST | `/v1/admin/pages` | `content.write` | Content pages |
| PATCH | `/v1/admin/pages/{pageId}` | `content.write` | Update page |
| POST | `/v1/admin/uploads` | `catalog.write` or `content.write` | Signed upload URL for images/videos (same shape as agent uploads) |

## Video (Remotion)

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/v1/admin/video/templates` | `content.write` | Templates with props JSON Schema and formats |
| POST | `/v1/admin/video/renders` | `content.write` · Idempotent | Request a render `{templateCode, props, format}` |
| GET | `/v1/admin/video/renders` | `content.write` | Render history |
| GET | `/v1/admin/video/renders/{renderId}` | `content.write` | Status and output URL |

## Reports

`GET /v1/admin/reports/{report}?from=YYYY-MM-DD&to=YYYY-MM-DD&format=json|csv` · permission `reports.finance` for financial reports, `dispatch.manage` for operational ones.

| `report` | Contents |
|---|---|
| `sales` | Revenue by day, product, zone, channel |
| `gst` | Taxable value and tax by HSN code and rate (GSTR-1 helper) |
| `subscriptions` | Active, new, paused, cancelled, churn reasons |
| `products` | Units and revenue per variant |
| `routes` | Deliveries, failures and on-time rate per route |
| `agents` | Stops, failure reasons, average time per stop |
| `wastage` | Wastage by variant and reason |
| `wallet` | Opening, top-ups, charges, refunds, closing float |

Large CSV exports run as jobs: the response is `202` with a job ID; `GET /v1/admin/jobs/{jobId}` returns a download URL when done.

## Settings, staff, audit

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/v1/admin/settings` | `settings.write` | All settings (cutoffs, wallet limits, overdraft, thresholds, buffer %, referral) |
| PATCH | `/v1/admin/settings` | `settings.write` | Update |
| GET/POST | `/v1/admin/tax-rates` | `settings.write` | HSN code → GST rate table |
| GET/POST | `/v1/admin/staff` | `staff.manage` | List / invite staff by Google email and role |
| PATCH | `/v1/admin/staff/{staffId}` | `staff.manage` | Change role / deactivate |
| GET | `/v1/admin/audit-log` | `audit.read` | Filter by actor, entity, action, date |
| GET/POST | `/v1/admin/api-keys` | `settings.write` | Server-to-server keys (scoped) |
| DELETE | `/v1/admin/api-keys/{keyId}` | `settings.write` | Revoke |
| GET | `/v1/admin/jobs/{jobId}` | any staff | Background job status |
| GET | `/v1/admin/queues` | `settings.write` | Queue health, failed jobs, retry |
