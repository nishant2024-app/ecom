# 11 · Operations and runbooks

## Daily rhythm

| When (IST) | What happens | Watch for |
|---|---|---|
| All day | Orders and payments | Payment provider errors, webhook signature failures |
| Every minute | Worker closes unpaid orders after 30 min (after checking Cashfree) | Worker not running → stock stays reserved |
| Morning | Warehouse packs yesterday's and overnight paid orders (Admin → Orders → To pack) | Orders older than 1 day still "To pack" |
| Afternoon | Courier pickup; staff mark shipped with AWB | "To ship" not cleared before pickup |
| 01:00 | Database backup | Backup age alerts |
| Weekly | Review low stock and batches expiring within 30 days (dashboard) | Stock below reorder level |

## Monitoring

| Signal | Alert when | Severity |
|---|---|---|
| Storefront / API uptime (`/v1/health/ready`) | 2 failed checks | SEV-1 |
| API 5xx rate | > 1% for 5 min | SEV-2 |
| Payments stuck in `created` > 1 h with order still pending | any | SEV-2 |
| Webhook signature failures | > 5 in 10 min | SEV-2 (misconfigured secret or attack) |
| Worker heartbeat (`orders.expiry` log or process up) | missing 10 min | SEV-2 |
| Paid orders not packed after 24 h | any | SEV-3 |
| Refund status `failed` | any | SEV-2 |
| Postgres disk > 75%, backup older than 26 h | — | SEV-2 |
| Oracle spend > ₹1 | any | SEV-2 |

## Backups

pgBackRest: nightly full + continuous WAL to R2 and OCI Object Storage (different credentials), 14 days point-in-time recovery, monthly automated restore test. See [03 · Infrastructure](03-infrastructure.md).

## Deploys

GitHub Actions → SSH over Cloudflare Tunnel → `docker compose up -d --build` with the migrate container first; rolling API restart on `/v1/health/ready`. Migrations are expand/contract. Avoid deploying during the courier pickup window.

## Runbooks

### Site or API down
1. Uptime check: everything or one service? `docker compose ps` on the app VM; restart crashed services.
2. If `cloudflared` is down everything looks down; restart it.
3. Check the data VM (Postgres, Valkey), disk and memory.
4. VM gone (Oracle reclaimed it): see *Server lost*.

### Customer paid but order still "Awaiting payment"
1. Admin → Orders → open the order → Payment shows the payment ID.
2. Check the payment in the Cashfree dashboard by that ID (it is the Cashfree `order_id`).
3. If Cashfree shows PAID: the worker will confirm it within a minute of the payment window ending. To act sooner, check webhook delivery logs in Cashfree and the API logs for signature failures (wrong `CASHFREE_SECRET_KEY` or API version).
4. If the order was already closed, the late payment is refunded automatically; confirm the refund in Admin and Cashfree and tell the customer.

### Webhooks failing
Signature failures → check the secret and that the webhook URL is `https://api.example.in/v1/webhooks/cashfree/payments`. Processing errors are stored in `webhook_events.error` and Cashfree retries; fix and let retries land.

### Refund failed
Admin → order shows refund `failed`. Retry by cancelling via Cashfree dashboard refund, or fix the provider issue and contact support; record the outcome in the order note. (A "retry refund" button is a next step.)

### Stock looks wrong
Inventory → size → batches and movements show every change with reason and reference. Correct with an adjustment (reason required). Reserved stock belongs to open orders; cancel those orders rather than editing reserved counts.

### Server lost / move to a new host
1. New VM (OpenTofu or console), run Ansible.
2. Restore Postgres from pgBackRest (R2 repository).
3. `docker compose up -d --build` with the tagged commit; point the Cloudflare Tunnel at it.
4. Target under 2 hours. Same steps move the stack to any paid VPS.

### Secret rotation
JWT key: add a new `kid`, deploy, remove the old key after 30 days. Cashfree: generate new keys, update secrets, deploy, revoke old. Database passwords, R2/OCI keys, tunnel token: rotate yearly and when someone with server access leaves.

### Security incident
Contain (revoke staff sessions in Admin → Settings → Team, rotate secrets, block IPs in Cloudflare), preserve logs, assess impact, notify affected customers and authorities as the DPDP Act requires, then write a blameless review in `docs/incidents/`.
