# 06 · Business rules

Implemented as pure functions in `packages/core` (unit and property tested) and enforced by the API. Values in *italics* are settings the owner can change.

## Time

All business dates are in IST (`Asia/Kolkata`, UTC+5:30). Order numbers and reports use the IST date the order was placed.

## Catalog and stock

- A product has one or more **sizes** (variants) with SKU, price (GST-inclusive), MRP, shipping weight, HSN code, GST rate, shelf life, storage and reorder level.
- Stock is tracked per **batch** (manufacture date, expiry date, quantity). Every change is a row in the stock movement ledger: `produced`, `reserved`, `released`, `shipped`, `adjusted`, `wasted`, `returned`.
- **Available** = on hand − reserved, over active batches that expire at least *7 days* from today. Stock closer to expiry is never sold.
- **Low stock** when available ≤ the size's reorder level (*default 20*). Shown on the product card ("Few left"), dashboard and inventory.
- Staff adjustments need a reason and can't reduce a batch below what's reserved for orders.

## Shipping

- Zones are lists of pincode prefixes. The **longest matching prefix wins**: `411` (Pune) beats `41` (Maharashtra) beats `4` (rest of India).
- Each zone has a base fee, a *free-shipping threshold* (or none), *included weight* (e.g. 2 kg) and a *fee per extra started kilogram*, plus earliest/latest delivery days.
- A zone can be marked not serviceable (army post offices by default).
- Seed defaults (change in Admin → Settings): Pune ₹40, free above ₹499, 1–2 days · Maharashtra & Goa ₹60, free above ₹699, 2–4 days · rest of India ₹90, free above ₹999, 3–6 days · North East, J&K, islands ₹150, never free, 6–10 days.
- Delivery estimate shown to customers = today + zone days.

## Cart and quote

- The cart lives in the browser. Prices, stock and shipping are **always recalculated by the server** (`POST /v1/store/checkout/quote`); client prices are never trusted.
- Per-line problems: no longer sold, out of stock, more than available, more than the *max per order* (default 10).
- Tax shown is the GST included in prices, back-calculated per line from the HSN rate.

## Orders

```
pending_payment ──pay──▶ confirmed ──pack──▶ packed ──ship──▶ shipped ──deliver──▶ delivered
       │                     │                  │
       └──expire──▶ cancelled ◀──cancel─────────┘   (paid orders are refunded in full)
```

| Rule | Detail |
|---|---|
| Placing | Requires sign-in, a saved address and a serviceable pincode. All lines must be sellable and in stock. Uses an `Idempotency-Key`, so a retry never creates a second order. |
| Stock | Reserved FEFO with row locks at placement, so two shoppers can't buy the same last unit. |
| Payment window | *30 minutes*. Then the worker asks Cashfree whether it was paid (in case the webhook was missed); if not, the order closes and stock is released. |
| Pay again | An unpaid order inside its window can start a new payment attempt. |
| Paid late | If money arrives for an order that was already closed, it's refunded automatically. |
| Customer cancel | Allowed until packed. Stock released; full refund to the original payment method. |
| Staff cancel | Until shipped, with a reason (permission `orders.refund`). Same release and refund. |
| Ship | Requires courier and AWB. Reserved stock leaves the batches (on hand and reserved both decrease). |
| History | Every transition is an order event with actor and time, shown to the customer and in admin. |
| Numbers | `D-YYMMDD-NNNN`, sequential per IST day. |

## Payments

Cashfree (or the mock provider in development). See [07 · Payments](07-payments-cashfree.md). Prepaid only; no cash on delivery at launch.

## GST

- Prices include GST. Each size has an HSN code and rate (basis points). **Rates in the seed are placeholders: confirm every rate with the business's accountant.**
- `invoiceTotals` splits tax into CGST/SGST (intra-state) or IGST (inter-state). Invoice numbering helper: `INV/26-27/000123` (sequential per financial year, ≤16 characters). PDF invoices are a next step.

## Staff and permissions

Roles map to permissions in `apps/api/src/lib/permissions.ts` (see [04 · Authentication](04-authentication.md#roles-and-permissions)). Price changes need `pricing.write` even for someone who can edit product copy. Every staff write is in the audit log with before/after values.
