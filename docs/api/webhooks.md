# Webhooks (inbound)

Cashfree calls these endpoints to tell us about payments, refunds and mandates. Design and verification details: [Payments](../07-payments-cashfree.md).

| Method | Path | Cashfree events |
|---|---|---|
| POST | `/v1/webhooks/cashfree/payments` | `PAYMENT_SUCCESS_WEBHOOK`, `PAYMENT_FAILED_WEBHOOK`, `PAYMENT_USER_DROPPED_WEBHOOK`, `REFUND_STATUS_WEBHOOK` |
| POST | `/v1/webhooks/cashfree/subscriptions` | Subscription/mandate status changes and charge results for UPI Autopay |
| POST | `/v1/webhooks/cashfree/vendors` | (Later) Easy Split vendor settlement and status events |

Configure the URLs in the Cashfree dashboard for each environment (sandbox → staging URL, production → production URL).

## Security

| Check | Rule |
|---|---|
| Transport | HTTPS only (Cloudflare) |
| Signature | `x-webhook-signature` = base64 HMAC-SHA256 of `x-webhook-timestamp` + raw body, keyed with the Cashfree secret key. Constant-time compare. |
| Freshness | Reject timestamps older than 5 minutes |
| Raw body | The route reads the body as a raw buffer; signature is checked before JSON parsing |
| Replay | Event stored in `webhook_events` with a unique key; duplicates are acknowledged and ignored |
| Not authenticated otherwise | These routes skip cookie/bearer auth and CSRF; the signature is the authentication |
| WAF | Cloudflare rule allows these paths only via `POST` with `application/json` |

## Responses

| We return | When | Cashfree does |
|---|---|---|
| `200` | Processed, or duplicate | Stops |
| `400` | Signature invalid or malformed | Stops (logged and alerted: may indicate misconfiguration or an attack) |
| `500` | Our failure after storing the event | Retries with backoff; our worker also retries from `webhook_events` |

Processing must finish within a few seconds. Follow-up work (notifications, invoice PDFs) is queued.

## Processing rules

| Event | Effect (one transaction) |
|---|---|
| Payment success, purpose `topup` | `payments → success`, `topups → paid`, ledger credit, wallet balance += amount, queue "top-up successful" push |
| Payment success, purpose `order` | `payments → success`, order `pending_payment → confirmed` |
| Payment success for an already final payment | No-op (logged) |
| Payment success after our order expired | Mark payment `success`, credit the amount to the **wallet** (never lose money), notify customer |
| Payment failed / user dropped | `payments → failed` / `user_dropped`; top-up `failed`; order stays `pending_payment` until expiry |
| Refund status | Update `refunds.status`; on failure alert finance |
| Mandate activated / cancelled / paused | Update `autopay_mandates.status` |
| Autopay charge success | Same as top-up success with `source = autopay` |
| Autopay charge failed | Notify customer; after 2 consecutive failures, pause autopay and tell the customer |

## Testing locally

1. Run the API locally.
2. Expose it with `cloudflared tunnel --url http://localhost:4000` (free, temporary URL).
3. Set that URL in the Cashfree **sandbox** dashboard as the webhook endpoint.
4. Use Cashfree sandbox test payment methods.
5. Captured payloads go in `apps/api/test/fixtures/cashfree/` for unit tests.
