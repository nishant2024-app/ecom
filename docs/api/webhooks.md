# Webhooks (inbound)

| Method | Path | Events |
|---|---|---|
| POST | `/v1/webhooks/cashfree/payments` | `PAYMENT_SUCCESS_WEBHOOK`, `PAYMENT_FAILED_WEBHOOK`, `PAYMENT_USER_DROPPED_WEBHOOK` |

Configure this URL in the Cashfree dashboard for each environment (sandbox → staging, production → production). Our Cashfree `order_id` is our payment ID (`pay_…`), which is how events find the payment.

## Security

- `x-webhook-signature` must equal `base64(HMAC-SHA256(secret, x-webhook-timestamp + rawBody))`, compared in constant time; the raw body is captured before JSON parsing.
- `x-webhook-timestamp` must be within 5 minutes.
- No cookie/bearer auth or CSRF on this route; the signature is the authentication.
- Each event is stored once in `webhook_events` (unique key from type, order, payment ID and status) before processing.

## Responses

| We return | When |
|---|---|
| `200 {"status":"processed"}` | Applied |
| `200 {"status":"duplicate"}` | Already received |
| `400` | Invalid or stale signature (logged as a warning) |
| `500` | Processing failed; the error is saved on the event and Cashfree retries |

## Effects

| Event | Effect |
|---|---|
| Payment success | Payment `success` (with Cashfree payment ID and method); order `pending_payment → confirmed`. If the order was already closed, the money is refunded automatically. Repeat events are no-ops. |
| Payment failed / user dropped | Payment marked `failed` / `user_dropped`; the order stays open until its payment window ends so the customer can retry. |

## Local testing

Expose the local API with `cloudflared tunnel --url http://localhost:4000`, set that URL in the Cashfree sandbox, and pay with Cashfree test UPI IDs or cards. Without Cashfree keys, the mock provider and the storefront's test payment page exercise the same order logic.
