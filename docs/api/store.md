# Store endpoints

Customer-facing endpoints used by the storefront and the future Android app. Conventions: [API guide](README.md). Rules behind them: [Business rules](../06-business-rules.md).

**Auth:** endpoints marked *Public* need none; everything else needs a signed-in customer.

## Index

| Method | Path | Auth | Description |
|---|---|---|---|
| **Catalog** ||||
| GET | `/v1/store/serviceability` | Public | Check a pincode or location |
| GET | `/v1/store/categories` | Public | Category tree |
| GET | `/v1/store/products` | Public | List products (filter, search) |
| GET | `/v1/store/products/{slug}` | Public | Product detail with variants |
| GET | `/v1/store/delivery-slots` | Public | Slots, cutoffs and next available dates for a zone |
| GET | `/v1/store/home` | Public | Home page blocks and banners |
| **Profile** ||||
| GET | `/v1/store/me` | Customer | My profile |
| PATCH | `/v1/store/me` | Customer | Update name, phone, language |
| DELETE | `/v1/store/me` | Customer | Request account deletion |
| GET | `/v1/store/me/addresses` | Customer | List addresses |
| POST | `/v1/store/me/addresses` | Customer | Add address |
| PATCH | `/v1/store/me/addresses/{addressId}` | Customer | Update address |
| DELETE | `/v1/store/me/addresses/{addressId}` | Customer | Remove address |
| POST | `/v1/store/me/devices` | Customer | Register a push token |
| DELETE | `/v1/store/me/devices/{deviceId}` | Customer | Remove a push token |
| GET | `/v1/store/me/notification-preferences` | Customer | Get preferences |
| PUT | `/v1/store/me/notification-preferences` | Customer | Set preferences |
| GET | `/v1/store/me/bottles` | Customer | Bottle balance and history |
| GET | `/v1/store/me/referral` | Customer | My referral code and rewards |
| **Cart & orders** ||||
| GET | `/v1/store/cart` | Customer | Current cart with prices |
| PUT | `/v1/store/cart/items/{variantId}` | Customer | Set quantity (0 removes) |
| PUT | `/v1/store/cart/coupon` | Customer | Apply coupon |
| DELETE | `/v1/store/cart/coupon` | Customer | Remove coupon |
| POST | `/v1/store/checkout/quote` | Customer | Price the cart for a date, slot and address |
| POST | `/v1/store/orders` | Customer · Idempotent | Place a one-time order |
| GET | `/v1/store/orders` | Customer | My orders |
| GET | `/v1/store/orders/{orderId}` | Customer | Order detail |
| POST | `/v1/store/orders/{orderId}/cancel` | Customer | Cancel before cutoff |
| **Subscriptions** ||||
| GET | `/v1/store/subscriptions` | Customer | My subscriptions |
| POST | `/v1/store/subscriptions` | Customer · Idempotent | Create a subscription |
| GET | `/v1/store/subscriptions/{subscriptionId}` | Customer | Detail |
| PATCH | `/v1/store/subscriptions/{subscriptionId}` | Customer | Change pattern, items, address, slot (from next open date) |
| POST | `/v1/store/subscriptions/{subscriptionId}/pauses` | Customer | Pause a date range |
| DELETE | `/v1/store/subscriptions/{subscriptionId}/pauses/{pauseId}` | Customer | Remove or shorten a pause |
| PUT | `/v1/store/subscriptions/{subscriptionId}/overrides/{date}` | Customer | Change one date |
| DELETE | `/v1/store/subscriptions/{subscriptionId}/overrides/{date}` | Customer | Undo a one-date change |
| POST | `/v1/store/subscriptions/{subscriptionId}/cancel` | Customer | Cancel |
| GET | `/v1/store/calendar` | Customer | Month view: planned and past deliveries (the milk card) |
| **Deliveries** ||||
| GET | `/v1/store/deliveries` | Customer | Deliveries in a date range |
| GET | `/v1/store/deliveries/{deliveryId}` | Customer | Detail, status, proof |
| POST | `/v1/store/deliveries/{deliveryId}/issues` | Customer | Report a problem |
| **Wallet & payments** ||||
| GET | `/v1/store/wallet` | Customer | Balance, projected spend, autopay status |
| GET | `/v1/store/wallet/ledger` | Customer | Ledger entries |
| POST | `/v1/store/wallet/topups` | Customer · Idempotent | Start a top-up |
| GET | `/v1/store/wallet/topups/{topupId}` | Customer | Top-up status |
| GET | `/v1/store/wallet/autopay` | Customer | Autopay mandate |
| POST | `/v1/store/wallet/autopay` | Customer · Idempotent | Set up autopay |
| DELETE | `/v1/store/wallet/autopay` | Customer | Cancel autopay |
| GET | `/v1/store/payments/{paymentId}` | Customer | Payment status (for online orders) |
| **Statements & invoices** ||||
| GET | `/v1/store/statements/{month}` | Customer | Monthly statement (`YYYY-MM`) |
| GET | `/v1/store/statements/{month}/pdf` | Customer | Statement PDF (302 to signed URL) |
| GET | `/v1/store/invoices` | Customer | List invoices |
| GET | `/v1/store/invoices/{invoiceId}/pdf` | Customer | Invoice PDF (302 to signed URL) |
| **Notifications** ||||
| GET | `/v1/store/notifications` | Customer | In-app notifications |
| POST | `/v1/store/notifications/read` | Customer | Mark as read |

---

## Catalog

### GET /v1/store/serviceability

Query: `pincode` (6 digits) **or** `lat` + `lng`.

```http
GET /v1/store/serviceability?pincode=411045
```

```json
200 OK
{
  "serviceable": true,
  "zone": { "id": "zon_01JD…", "name": "Baner – Balewadi" },
  "needsPin": false,
  "slots": [
    { "id": "slt_01JD…", "code": "morning", "label": "5–8 AM", "nextDeliveryDate": "2026-12-02", "cutoffAt": "2026-12-01T16:30:00Z" }
  ]
}
```

`needsPin: true` means the pincode spans several zones; ask for a map pin. Not serviceable → `200` with `"serviceable": false` (not an error), so the UI can offer "notify me".

### GET /v1/store/products

Query parameters:

| Param | Type | Notes |
|---|---|---|
| `zoneId` | string | Only products available in this zone. Recommended once known. |
| `category` | string | Category slug |
| `q` | string | Search; understands Hindi/Hinglish synonyms (`doodh`, `dahi`, `makhan`) and typos |
| `subscribable` | boolean | Only subscribable variants |
| `cursor`, `limit` | | Pagination |

```json
200 OK
{
  "data": [
    {
      "id": "prd_01JD…",
      "slug": "toned-milk",
      "name": "Toned Milk",
      "category": { "slug": "milk", "name": "Milk" },
      "image": { "url": "https://media.example.in/p/toned-milk/640.avif", "alt": "Toned milk pouch", "width": 640, "height": 800 },
      "isVeg": true,
      "attributes": { "animal": "cow", "fatPercent": 3.0, "snfPercent": 8.5 },
      "fromPrice": { "amount": 3200, "currency": "INR" },
      "variants": [
        { "id": "var_01JD…", "packSize": "500 ml", "price": { "amount": 3200, "currency": "INR" }, "subscriptionPrice": { "amount": 3000, "currency": "INR" }, "subscribable": true, "available": true }
      ]
    }
  ],
  "page": { "nextCursor": null, "hasMore": false }
}
```

### GET /v1/store/products/{slug}

Adds: full description, all media (images and generated reels), nutrition table, shelf life, storage, packaging, bottle deposit, FSSAI number, HSN code, and per-variant availability for `zoneId`.

### GET /v1/store/delivery-slots

Query: `zoneId` (required), `from` (date, default today), `days` (default 14, max 31). Returns each slot with the open dates and their cutoff times, excluding holidays.

```json
200 OK
{
  "data": [
    {
      "id": "slt_01JD…",
      "code": "morning",
      "label": "5–8 AM",
      "dates": [
        { "date": "2026-12-02", "cutoffAt": "2026-12-01T16:30:00Z", "open": true },
        { "date": "2026-12-03", "cutoffAt": "2026-12-02T16:30:00Z", "open": true }
      ]
    }
  ]
}
```

---

## Profile

### PATCH /v1/store/me

```json
{ "name": "Asha Verma", "phone": "+919876543210", "language": "hi" }
```

`phone` must be a valid Indian mobile number (E.164, `+91` followed by 10 digits starting 6–9). It's not OTP-verified.

### POST /v1/store/me/addresses

```json
{
  "label": "Home",
  "line1": "B-704, Sai Residency",
  "line2": "Baner Road",
  "landmark": "Opp. D-Mart",
  "society": "Sai Residency",
  "city": "Pune",
  "state": "Maharashtra",
  "pincode": "411045",
  "location": { "lat": 18.5590, "lng": 73.7868 },
  "deliveryInstructions": "Leave at door, don't ring bell before 7",
  "isDefault": true
}
```

`201 Created` with the address including resolved `zoneId`. `422 NOT_SERVICEABLE` if outside all zones.

### DELETE /v1/store/me

Starts account deletion (see [Authentication → Account deletion](../04-authentication.md#account-deletion)). `202 Accepted`:

```json
{ "status": "deletion_requested", "erasesOn": "2026-12-31", "walletRefund": { "amount": 41800, "currency": "INR" } }
```

### POST /v1/store/me/devices

```json
{ "platform": "android", "pushToken": "fcm-token…", "appVersion": "1.0.3 (34)" }
```

Web push uses `"platform": "web"` and `pushToken` = the JSON-serialised `PushSubscription`.

---

## Cart and one-time orders

### PUT /v1/store/cart/items/{variantId}

```json
{ "quantity": 2 }
```

Returns the full cart (same as `GET /v1/store/cart`).

### POST /v1/store/checkout/quote

Prices the cart for a specific delivery without placing it.

```json
{ "addressId": "adr_01JD…", "slotId": "slt_01JD…", "deliveryDate": "2026-12-02" }
```

```json
200 OK
{
  "lines": [
    { "variantId": "var_01JD…", "name": "Paneer 200 g", "quantity": 2, "unitPrice": { "amount": 9000, "currency": "INR" }, "total": { "amount": 18000, "currency": "INR" } }
  ],
  "subtotal": { "amount": 18000, "currency": "INR" },
  "discount": { "amount": 0, "currency": "INR" },
  "deposit": { "amount": 0, "currency": "INR" },
  "total": { "amount": 18000, "currency": "INR" },
  "taxIncluded": { "amount": 857, "currency": "INR" },
  "walletBalance": { "amount": 41800, "currency": "INR" },
  "canPayFromWallet": true,
  "cutoffAt": "2026-12-01T16:30:00Z",
  "warnings": []
}
```

### POST /v1/store/orders

**Idempotent.** Places the order.

```http
POST /v1/store/orders
Idempotency-Key: 6c0f8a36-0f3e-4d6b-9a1e-3a5d9f1c2b7e
```

```json
{ "addressId": "adr_01JD…", "slotId": "slt_01JD…", "deliveryDate": "2026-12-02", "paymentMethod": "wallet" }
```

| `paymentMethod` | Result |
|---|---|
| `wallet` | `201` with order `status: "confirmed"`. Wallet debited immediately. |
| `online` | `201` with order `status: "pending_payment"` and `payment: { id, paymentSessionId }`. Open Cashfree checkout, then poll `GET /v1/store/payments/{paymentId}`. |

**Errors:** `CUTOFF_PASSED`, `INVALID_DELIVERY_DATE`, `PRODUCT_UNAVAILABLE`, `INSUFFICIENT_WALLET_BALANCE`, `MIN_ORDER_VALUE`, `COUPON_INVALID`, `NOT_SERVICEABLE`, `PROFILE_INCOMPLETE`.

### POST /v1/store/orders/{orderId}/cancel

Allowed until the cutoff for the order's date. Wallet-paid orders are refunded to the wallet; online-paid orders to the wallet by default, or `{ "refundTo": "source" }`.

---

## Subscriptions

### POST /v1/store/subscriptions

**Idempotent.**

```json
{
  "addressId": "adr_01JD…",
  "slotId": "slt_01JD…",
  "pattern": "weekdays",
  "startsOn": "2026-12-02",
  "items": [
    { "variantId": "var_toned500", "weekdayQuantities": [2, 2, 2, 2, 2, 3, 3] },
    { "variantId": "var_curd400", "weekdayQuantities": [0, 0, 0, 0, 0, 1, 1] }
  ]
}
```

| `pattern` | Item fields |
|---|---|
| `daily` | `quantity` |
| `alternate` | `quantity`; delivery days counted from `startsOn` |
| `weekdays` | `weekdayQuantities`: 7 integers, Monday first |

```json
201 Created
{
  "id": "sub_01JD…",
  "status": "active",
  "pattern": "weekdays",
  "startsOn": "2026-12-02",
  "endsOn": null,
  "address": { "id": "adr_01JD…", "label": "Home" },
  "slot": { "id": "slt_01JD…", "code": "morning", "label": "5–8 AM" },
  "items": [ { "variantId": "var_toned500", "name": "Toned Milk 500 ml", "weekdayQuantities": [2,2,2,2,2,3,3], "unitPrice": { "amount": 3000, "currency": "INR" } } ],
  "estimatedMonthly": { "amount": 198000, "currency": "INR" },
  "pauses": [],
  "nextDelivery": { "date": "2026-12-02", "cutoffAt": "2026-12-01T16:30:00Z" }
}
```

### POST /v1/store/subscriptions/{id}/pauses

```json
{ "startsOn": "2026-12-20", "endsOn": "2026-12-27" }
```

`201` with the pause. `422 CUTOFF_PASSED` if `startsOn` is at or before the next closed date.

### PUT /v1/store/subscriptions/{id}/overrides/{date}

Change one date. An empty `items` array skips that day.

```json
{ "items": [ { "variantId": "var_toned500", "quantity": 4 } ] }
```

### GET /v1/store/calendar

The milk card. Query: `month` (`YYYY-MM`, required).

```json
200 OK
{
  "month": "2026-12",
  "today": "2026-12-01",
  "days": [
    {
      "date": "2026-12-01",
      "state": "delivered",
      "deliveryId": "dlv_01JD…",
      "items": [ { "variantId": "var_toned500", "name": "Toned Milk 500 ml", "quantity": 2 } ],
      "charge": { "amount": 6000, "currency": "INR" },
      "editable": false
    },
    {
      "date": "2026-12-02",
      "state": "planned",
      "items": [ { "variantId": "var_toned500", "name": "Toned Milk 500 ml", "quantity": 2 } ],
      "estimatedCharge": { "amount": 6000, "currency": "INR" },
      "editable": true,
      "cutoffAt": "2026-12-01T16:30:00Z"
    },
    { "date": "2026-12-20", "state": "paused", "items": [], "editable": true }
  ],
  "totals": { "deliveredDays": 1, "units": 2, "spent": { "amount": 6000, "currency": "INR" } }
}
```

`state` values: `planned`, `scheduled` (after cutoff), `out_for_delivery`, `delivered`, `not_available`, `refused`, `missed`, `skipped_low_balance`, `paused`, `holiday`, `none`.

---

## Deliveries

### GET /v1/store/deliveries/{deliveryId}

```json
200 OK
{
  "id": "dlv_01JD…",
  "date": "2026-12-01",
  "slot": { "code": "morning", "label": "5–8 AM" },
  "status": "delivered",
  "items": [ { "name": "Toned Milk 500 ml", "quantity": 2, "batch": "TM-261130-A", "expiresOn": "2026-12-03" } ],
  "charge": { "amount": 6000, "currency": "INR" },
  "events": [
    { "type": "out_for_delivery", "at": "2026-12-01T00:05:00Z" },
    { "type": "delivered", "at": "2026-12-01T01:12:00Z", "bottlesCollected": 0 }
  ],
  "proofPhotoUrl": null,
  "invoiceId": "inv_01JD…"
}
```

### POST /v1/store/deliveries/{deliveryId}/issues

```json
{ "type": "damaged", "note": "Pouch leaking", "photoUploadId": null }
```

`type`: `not_received`, `damaged`, `wrong_item`, `quality`, `late`, `other`. Creates a support ticket; some types (e.g. `not_received` within 2 hours) trigger an automatic wallet credit per settings.

---

## Wallet

### GET /v1/store/wallet

```json
200 OK
{
  "balance": { "amount": 41800, "currency": "INR" },
  "overdraftLimit": { "amount": 0, "currency": "INR" },
  "projected": { "next7Days": { "amount": 42000, "currency": "INR" }, "runsOutOn": "2026-12-08" },
  "lowBalance": false,
  "autopay": { "status": "active", "threshold": { "amount": 15000, "currency": "INR" }, "recharge": { "amount": 50000, "currency": "INR" } }
}
```

### GET /v1/store/wallet/ledger

```json
200 OK
{
  "data": [
    { "id": "txn_01JD…", "kind": "delivery_charge", "amount": { "amount": -6000, "currency": "INR" }, "balanceAfter": { "amount": 41800, "currency": "INR" }, "memo": "Delivery 2 Dec · 2 × Toned Milk 500 ml", "reference": { "type": "delivery", "id": "dlv_01JD…" }, "createdAt": "2026-12-01T16:30:04Z" },
    { "id": "txn_01JC…", "kind": "topup", "amount": { "amount": 50000, "currency": "INR" }, "balanceAfter": { "amount": 47800, "currency": "INR" }, "memo": "Top-up via UPI", "reference": { "type": "topup", "id": "top_01JC…" }, "createdAt": "2026-11-30T05:02:10Z" }
  ],
  "page": { "nextCursor": "…", "hasMore": true }
}
```

### POST /v1/store/wallet/topups

**Idempotent.**

```json
{ "amount": { "amount": 50000, "currency": "INR" } }
```

```json
201 Created
{
  "id": "top_01JD…",
  "status": "pending",
  "amount": { "amount": 50000, "currency": "INR" },
  "payment": { "id": "pay_01JD…", "provider": "cashfree", "paymentSessionId": "session_…", "environment": "production" }
}
```

Open Cashfree checkout with `paymentSessionId`, then poll `GET /v1/store/wallet/topups/{id}` until `status` is `paid`, `failed` or `expired`.

**Errors:** `WALLET_LIMIT_EXCEEDED`, `RATE_LIMITED`.

### POST /v1/store/wallet/autopay

```json
{ "threshold": { "amount": 15000, "currency": "INR" }, "recharge": { "amount": 50000, "currency": "INR" }, "monthlyCap": { "amount": 300000, "currency": "INR" } }
```

`201` with `{ "status": "pending_authorisation", "authorisation": { "url": "…" } }`. The customer approves in their UPI app; status becomes `active` via webhook.

---

## Statements and invoices

### GET /v1/store/statements/{month}

```json
200 OK
{
  "month": "2026-11",
  "opening": { "amount": 12000, "currency": "INR" },
  "topups": { "amount": 200000, "currency": "INR" },
  "charges": { "amount": -178000, "currency": "INR" },
  "refunds": { "amount": 6000, "currency": "INR" },
  "closing": { "amount": 40000, "currency": "INR" },
  "deliveredDays": 29,
  "byProduct": [ { "name": "Toned Milk 500 ml", "units": 62, "amount": { "amount": 186000, "currency": "INR" } } ],
  "recapVideoUrl": "https://media.example.in/recap/cus_01JD…/2026-11.mp4",
  "pdfUrl": "/v1/store/statements/2026-11/pdf"
}
```
