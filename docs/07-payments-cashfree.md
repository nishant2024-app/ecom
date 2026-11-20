# 07 · Payments with Cashfree

All payments are in INR through **Cashfree Payments**. Two Cashfree products are used:

| Product | Used for |
|---|---|
| **Payment Gateway (PG)** | Wallet top-ups and one-time online orders. UPI, cards, net banking, wallets. |
| **Subscriptions (UPI Autopay / eNACH)** | Optional automatic wallet recharge when the balance runs low |
| **Easy Split** (later) | Paying vendors automatically when multi-vendor is switched on |

Cashfree sits behind a `PaymentProvider` interface in `apps/api/src/payments`, so a second gateway can be added without touching business logic.

## Accounts and keys

| Environment | Cashfree mode | API base URL | Keys (env vars) |
|---|---|---|---|
| local, staging | Sandbox | `https://sandbox.cashfree.com/pg` | `CASHFREE_APP_ID`, `CASHFREE_SECRET_KEY` (test) |
| production | Production | `https://api.cashfree.com/pg` | Live keys, only on the production server |

- Pin the Cashfree API version with the `x-api-version` header (set in config as `CASHFREE_API_VERSION`). Upgrade deliberately.
- Whitelist the production domain and webhook URL in the Cashfree dashboard.
- Keys never reach the browser or the Android app. Clients only ever see a `payment_session_id`.

## Top-up flow

1. Client calls `POST /v1/store/wallet/topups` with `{ amount }` and an `Idempotency-Key` header.
2. API validates limits, creates a `topups` row and a `payments` row (`status = created`).
3. API calls Cashfree **Create Order** with:
   - `order_id` = our payment ID (`pay_…`)
   - `order_amount` = amount in rupees with 2 decimals (converted from paise in one helper; never by hand)
   - `order_currency` = `INR`
   - `customer_details` = customer ID, name, email, phone
   - `order_meta.return_url` = `https://example.in/wallet/topup/{topupId}?status={order_status}`
   - `order_meta.notify_url` = `https://api.example.in/v1/webhooks/cashfree/payments`
   - `order_expiry_time` = now + 30 minutes
4. API returns `{ topupId, paymentId, paymentSessionId }`.
5. Client opens Cashfree checkout:
   - **Web:** Cashfree JS SDK (`@cashfreepayments/cashfree-js`) → `cashfree.checkout({ paymentSessionId, redirectTarget: '_self' })`
   - **Android (later):** Cashfree Android SDK with the same `paymentSessionId`
6. Customer pays. Cashfree redirects back and also sends a webhook.
7. **Webhook** (`PAYMENT_SUCCESS_WEBHOOK`) → verify → in one transaction: `payments.status = success`, `topups.status = paid`, ledger credit, balance update.
8. Client polls `GET /v1/store/wallet/topups/{id}` (every 2 s, up to 60 s) and shows the result.
9. If no webhook arrives within 2 minutes, the `payments` worker calls Cashfree **Get Order** / **Get Payments for an Order** and settles the status from Cashfree's answer.

**Rule: the redirect is never trusted.** Only a verified webhook or a server-to-server status check changes payment state.

## One-time orders paid online

Same as top-up, with `purpose = order`. On success the order moves `pending_payment → confirmed`. If payment fails or expires, the order is cancelled and any reserved stock released.

Most customers pay one-time orders **from the wallet**, which needs no gateway round trip.

## Webhook verification

Endpoint: `POST /v1/webhooks/cashfree/payments` (and `/subscriptions`). Details in [API → Webhooks](api/webhooks.md).

1. Read the **raw body** (Fastify route with a raw-body content-type parser; don't verify a re-serialised JSON).
2. Headers: `x-webhook-signature`, `x-webhook-timestamp`.
3. Compute `base64(HMAC-SHA256(secretKey, timestamp + rawBody))` and compare with the signature using a constant-time comparison.
4. Reject if the timestamp is more than 5 minutes old (replay protection).
5. Store the event in `webhook_events` (unique on Cashfree's event identity) **before** processing. Duplicate → return `200` and do nothing.
6. Process in a transaction; return `200` quickly. Heavy follow-ups (notifications) go to a queue.
7. Any failure after storing → return `500` so Cashfree retries; the stored event is retried by our worker too.

> Cashfree's documentation shows the signed string both as `timestamp + rawBody` and in a `timestamp.payload` form in different examples. **Phase 3 includes a sandbox test that pins the exact format** before go-live; the verification function has a unit test with a real captured sandbox payload.

## UPI Autopay (auto-recharge)

1. Customer opts in on the wallet page: threshold (e.g. ₹150), recharge amount (e.g. ₹500), monthly cap.
2. API creates a Cashfree subscription plan/mandate (on-demand type, max amount = recharge amount) and returns the authorisation link/session.
3. Customer approves the mandate once in their UPI app.
4. Webhook marks `autopay_mandates.status = active`.
5. When the balance drops below the threshold (checked after each cutoff charge), the `wallet` worker raises a charge against the mandate (subject to the cap and NPCI pre-debit notification rules handled by Cashfree).
6. Successful charge → a `topups` row with `source = autopay` and a ledger credit, same as a manual top-up.
7. Customer can cancel any time from the wallet page or their UPI app; cancellation webhooks update our record.

## Refunds

| Case | Destination |
|---|---|
| Delivery missed / damaged (our fault) | Wallet, automatic |
| One-time order cancelled before cutoff | Wallet (default), or source on request |
| Account closure with positive balance | Original payment source via Cashfree **Create Refund**, oldest top-ups first |
| Duplicate payment | Source |

Refunds to source use a refund ID = our `refunds.id` (idempotent). Status changes arrive by `REFUND_STATUS_WEBHOOK`.

## Reconciliation

Daily at 06:00 IST, the `payments` worker:

1. Fetches settlements for the previous day from Cashfree.
2. Matches each settled payment to our `payments` row.
3. Flags: payments successful at Cashfree but not in our DB, payments in our DB not settled after T+3, amount mismatches.
4. Records fees and GST on fees per settlement.
5. Shows results in **Admin → Payments → Reconciliation**. Mismatches alert the accountant.

## Testing

- Unit test: signature verification with captured sandbox payloads (valid, tampered body, wrong secret, stale timestamp).
- Integration: a Cashfree mock server for CI; real sandbox in staging.
- End-to-end on staging with Cashfree sandbox test UPI IDs and cards (from Cashfree's test data page).
- Chaos cases: webhook arrives before the client returns; webhook never arrives; webhook arrives twice; customer closes the tab mid-payment.

## Costs

Cashfree charges a fee per successful transaction, deducted from settlements. There's no monthly fee on the standard plan. Check current rates in the Cashfree dashboard; UPI is typically much cheaper than cards, so the checkout shows UPI first.
