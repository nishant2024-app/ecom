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
| Server disk > 80% or memory pressure (`df -h`, `free -h`) | any | SEV-2 |

## Backups

`scripts/backup.sh` (cron, 02:00) writes a `pg_dump` into `/opt/dairy/backups`, keeps 7 days there and uploads each dump to a separate private R2 bucket (30-day lifecycle rule). Photos stored on the server's disk are archived too. `scripts/restore.sh` restores into a scratch database to prove a backup works (or into the live database with `--live`). Test a restore every few months. Details: [DEPLOYMENT.md](../DEPLOYMENT.md#12-backups-do-this-before-real-orders). Point-in-time recovery (WAL archiving) is not set up; the most you can lose is one day of orders.

## Deploys

SSH to the server and run `scripts/deploy.sh`: it backs up, pulls the code, builds, runs the migrate container first, restarts and waits for `/v1/health/ready`. Migrations only add things (expand/contract) so a rollback is safe. Avoid deploying during the courier pickup window. Details: [DEPLOYMENT.md](../DEPLOYMENT.md#14-running-it-day-to-day).

## Runbooks

### Site or API down
1. Everything or one service? `dc ps` on the server (alias in DEPLOYMENT.md); restart crashed services with `dc restart <name>`.
2. If the shop and API both fail, check Nginx: `sudo systemctl status nginx`, `sudo nginx -t`, `/var/log/nginx/error.log`. (With Cloudflare Tunnel: `dc logs cloudflared`.)
3. Check Postgres and Valkey (`dc ps`, `dc logs postgres`), disk (`df -h`) and memory (`free -h`).
4. Server gone: see *Server lost*.

### Customer paid but order still "Awaiting payment"
1. Admin → Orders → open the order → Payment shows the payment ID.
2. Check the payment in the Cashfree dashboard by that ID (it is the Cashfree `order_id`).
3. If Cashfree shows PAID: the worker will confirm it within a minute of the payment window ending. To act sooner, check webhook delivery logs in Cashfree and the API logs for signature failures (wrong `CASHFREE_SECRET_KEY` or API version).
4. If the order was already closed, the late payment is refunded automatically; confirm the refund in Admin and Cashfree and tell the customer.

### Webhooks failing
Signature failures → check `CASHFREE_SECRET_KEY` and that the webhook URL is `https://api.example.in/v1/webhooks/cashfree/payments`. Processing errors are stored in `webhook_events.error` and Cashfree retries; fix and let retries land.

### Refund failed
Admin → order shows refund `failed`. Retry by cancelling via Cashfree dashboard refund, or fix the provider issue and contact support; record the outcome in the order note. (A "retry refund" button is a next step.)

### Stock looks wrong
Inventory → size → batches and movements show every change with reason and reference. Correct with an adjustment (reason required). Reserved stock belongs to open orders; cancel those orders rather than editing reserved counts.

### Server lost / move to a new host
1. New VPS; follow [DEPLOYMENT.md](../DEPLOYMENT.md) sections 2 to 7 (DNS, hardening, Docker, Nginx, `.env`).
2. Download the newest dump from the R2 backup bucket into `/opt/dairy/backups` and run `scripts/restore.sh <file> --live`.
3. Point the DNS A records at the new IP if it changed.
4. Target under 2 hours.

### Secret rotation
JWT key: add a new `kid`, deploy, remove the old key after 30 days. Cashfree: generate new keys, update secrets, deploy, revoke old. Database passwords, R2 keys, tunnel token (if used): rotate yearly and when someone with server access leaves.

### Security incident
Contain (revoke staff sessions in Admin → Settings → Team, rotate secrets, block IPs with `ufw deny from <ip>` or in Cloudflare), preserve logs, assess impact, notify affected customers and authorities as the DPDP Act requires, then write a blameless review in `docs/incidents/`.
