# Store endpoints

Customer-facing endpoints for the storefront and the future Android app. Conventions: [API guide](README.md). Full schemas: [openapi.json](openapi.json) (generated from code).

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/v1/store/categories` | Public | Categories with product count and pack visuals |
| GET | `/v1/store/products` | Public | List/search; each product has `image` (main photo with `srcset`, or `null` → draw the pack) (`category`, `q`, `featured`, `sort=price_asc|price_desc`, cursor) |
| GET | `/v1/store/products/{slug}` | Public | Detail with sizes, stock flags, photo `gallery`, nutrition, FSSAI/HSN, related products |
| GET | `/v1/store/content` | Public | Home page copy and images edited in Admin → Storefront (announcement, hero, story, promises, SEO) |
| GET | `/v1/store/shipping/estimate?pincode=` | Public | Zone, fee, free-shipping threshold, delivery dates |
| POST | `/v1/store/checkout/quote` | Public | Price a cart `{lines, pincode?}` with live prices, stock problems and shipping |
| GET / PATCH / DELETE | `/v1/store/me` | Customer | Profile; delete starts account deletion |
| GET / POST | `/v1/store/me/addresses` | Customer | Addresses (state derived from pincode, phone normalised to +91) |
| PATCH / DELETE | `/v1/store/me/addresses/{id}` | Customer | Update / remove |
| POST / DELETE | `/v1/store/me/devices[/{id}]` | Customer | Push tokens |
| GET / PUT | `/v1/store/me/notification-preferences` | Customer | `marketingEmail`, `orderUpdates` |
| POST | `/v1/store/orders` | Customer · Idempotent | Place order `{lines, addressId, note?}` → `{order, payment}` |
| GET | `/v1/store/orders` | Customer | My orders (cursor) |
| GET | `/v1/store/orders/{id}` | Customer | Detail: items, totals, address, timeline, events, payment, refunds, `canCancel` |
| POST | `/v1/store/orders/{id}/pay` | Customer | New payment attempt for an unpaid order |
| POST | `/v1/store/orders/{id}/cancel` | Customer | Cancel before packing; refunds automatically |

## Examples

### Quote

```http
POST /v1/store/checkout/quote
{ "lines": [{ "variantId": "var_…", "quantity": 1 }], "pincode": "411045" }
```

```json
{
  "lines": [{ "variantId": "var_…", "name": "UHT Toned Milk", "packSize": "1 L carton", "quantity": 1, "unitPrice": { "amount": 7800, "currency": "INR" }, "total": { "amount": 7800, "currency": "INR" }, "maxQuantity": 10, "problem": null, "pack": { "kind": "tetra", "color": "#F7F4EC", "accent": "#14432F" } }],
  "subtotal": { "amount": 7800, "currency": "INR" },
  "taxIncluded": { "amount": 0, "currency": "INR" },
  "shipping": { "zone": "Pune", "fee": { "amount": 4000, "currency": "INR" }, "free": false, "remainingForFree": { "amount": 42100, "currency": "INR" }, "etaMinDays": 1, "etaMaxDays": 2, "earliest": "2026-11-21", "latest": "2026-11-22" },
  "shippingError": null,
  "total": { "amount": 11800, "currency": "INR" },
  "ok": true
}
```

`problem` is `null`, `unavailable`, `out_of_stock`, `not_enough_stock` or `over_limit`.

### Place an order

```http
POST /v1/store/orders
Idempotency-Key: 6c0f8a36-0f3e-4d6b-9a1e-3a5d9f1c2b7e
{ "lines": [{ "variantId": "var_…", "quantity": 2 }], "addressId": "adr_…" }
```

`201` →

```json
{
  "order": { "id": "ord_…", "number": "D-261120-0007", "status": "pending_payment", "total": { "amount": 58000, "currency": "INR" }, "expiresAt": "2026-11-20T15:05:00.000Z", "…": "…" },
  "payment": { "id": "pay_…", "provider": "cashfree", "environment": "sandbox", "paymentSessionId": "session_…", "mockCheckoutPath": null }
}
```

Open Cashfree checkout with `paymentSessionId` (web: JS SDK; Android: Cashfree SDK). With the mock provider, `mockCheckoutPath` points to the storefront's test payment page. Then poll `GET /v1/store/orders/{id}` until `status` leaves `pending_payment`.

Errors: `NOT_SERVICEABLE`, `OUT_OF_STOCK` (detail names the product and how many are left), `PRODUCT_UNAVAILABLE`, `VALIDATION_FAILED`, `SERVICE_UNAVAILABLE` (payment provider down; the order is not kept).

## Development-only

With the mock provider and `AUTH_TEST_MODE=true` (never in production): `POST /v1/dev/sign-in {email}` signs in a test customer; `GET /v1/dev/payments/{id}` and `POST /v1/dev/payments/{id}/simulate {outcome}` complete a mock payment.
