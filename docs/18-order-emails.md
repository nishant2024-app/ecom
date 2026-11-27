# 18 · Order emails

Customers get an email when their order is **confirmed (paid)**, **shipped**, **delivered** and **cancelled** (with the refund). Marketing emails are not sent; customers can also turn order emails off in their account (`PUT /v1/store/me/notification-preferences {orderUpdates:false}`).

## How it works

1. When an order changes state, the API saves a row in the `notifications` table **in the same database transaction** (`services/outbox.ts`). So an email is queued if and only if the change was saved, and one order + one action can only ever queue one email.
2. The **worker** runs every minute (`services/order-emails.ts`): it builds the email from the live order, sends it through the chosen provider, and marks it `sent`.
3. If sending fails, it tries again the next minute, up to 5 times, then marks it `failed` with the error. Failures show on the order in the admin ("Emails to the customer") so nothing is lost silently.

The email is rendered at send time from the order's current data, so wording fixes apply to emails still waiting to go out.

## Turn on real sending

| `EMAIL_PROVIDER` | What it does | Free allowance |
|---|---|---|
| `log` (default) | Prints each email to the worker log. Nothing is sent | — |
| `resend` | Sends through [Resend](https://resend.com) with `RESEND_API_KEY` | about 100 a day |
| `brevo` | Sends through [Brevo](https://www.brevo.com) with `BREVO_API_KEY` | about 300 a day |

Also set `EMAIL_FROM`, for example `Mulshi Dairy <orders@yourdomain.in>`.

Steps (Resend or Brevo, same idea):

1. Create an account and **add your domain** to it.
2. Add the DNS records it shows (SPF, DKIM, and a DMARC record) in Cloudflare DNS. Wait until the provider says the domain is verified. Without this, emails land in spam.
3. Create an API key and put it in `/opt/dairy/.env`, with `EMAIL_PROVIDER=resend` (or `brevo`) and `EMAIL_FROM`.
4. Restart: `docker compose -f infra/compose/single.yml --env-file /opt/dairy/.env up -d`.
5. Place a sandbox order and check the confirmation arrives. The worker log line `emails.sent` shows what went out.

The API refuses to start if `EMAIL_PROVIDER=resend` or `brevo` is set without its key.

## Content

| Email | Subject | Contains |
|---|---|---|
| Confirmed | `Order D-… confirmed` | Amount paid, items, totals, delivery address, expected days, "cancel until packed" note, link to the order |
| Shipped | `Your order D-… is on its way` | Courier and tracking number, tracking link, expected days |
| Delivered | `Delivered: order D-…` | Thanks, the 48-hour problem window, link to rate the products |
| Cancelled | `Order D-… cancelled` | Reason, refund amount and the 5–7 day bank timeline (or "you were not charged") |

Each has an HTML version in the brand green and a plain-text version. Support email and phone come from Admin settings (`support.email`, `support.phone`).

## For the Android app

The app does not need to send mail. Push notifications for the same events use the same queue: add a `push` channel row beside the `email` row in `enqueueOrderEmail` and a sender for FCM in the worker. Tokens are already stored by `POST /v1/store/me/devices`.

## Limits

- Emails are sent about a minute after the event, not instantly.
- There is no delivery or open tracking.
- One email address per customer (their Google account email).
- Replies go to whatever mailbox `EMAIL_FROM` points to, so make sure `orders@yourdomain.in` forwards to someone (Cloudflare Email Routing does this free).
