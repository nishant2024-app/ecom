# 11 · Operations and runbooks

## The daily rhythm

Dairy operations run on a fixed clock. Monitoring and on-call follow it.

| Time (IST) | What happens | What can go wrong |
|---|---|---|
| 18:00–22:00 | Peak customer traffic: changes for tomorrow, top-ups | API latency, payment webhook delays |
| 21:00 | Cutoff reminder push (opt-in) | Push failures (low impact) |
| **22:00** | **Cutoff job** for tomorrow's morning slot | **Critical:** if it fails, no route sheets and no charges |
| 22:05 | Production plan and packing lists ready; customers notified | |
| 00:30–04:00 | Backups, monthly recaps (videos), heavy reports | Disk, CPU |
| 03:00–05:00 | Production and packing at the dairy | Dispatch staff need packing lists (print them at 22:30) |
| 05:00–08:00 | Agents deliver; agent app syncs | Agent app offline sync issues |
| 06:00 | Cashfree reconciliation | Mismatches |
| 08:00–18:00 | Support, admin work | |

## Monitoring

| Signal | Tool | Alert when | Severity |
|---|---|---|---|
| Storefront and API reachable | Uptime Kuma (micro VM) + UptimeRobot (external) | 2 failed checks in a row | SEV-1 |
| `/v1/health/ready` | Uptime Kuma | Fails for 2 min | SEV-1 |
| Cutoff job | Worker emits `cutoff_completed`; Prometheus alert | Not completed by cutoff + 15 min | **SEV-1** |
| API p95 latency | Prometheus (Fastify metrics) | > 500 ms for 10 min | SEV-2 |
| API 5xx rate | Prometheus | > 1% for 5 min | SEV-2 |
| Queue backlog / failed jobs | BullMQ metrics | Failed jobs > 0 in `cutoff`, `payments`; backlog > 1,000 | SEV-2 |
| Webhook signature failures | Logs → Loki alert | > 5 in 10 min | SEV-2 |
| Wallet cache ≠ ledger sum | Nightly check job | Any mismatch | SEV-2 |
| Reconciliation mismatch | Reconciliation job | Any | SEV-3 |
| Postgres disk | node exporter | > 75% | SEV-2 |
| Backup age | pgBackRest check | Last full backup > 26 h, WAL archive lag > 15 min | SEV-2 |
| Restore test | Monthly job | Failed | SEV-2 |
| Errors | Sentry | New error type in `api` or `worker` | SEV-3 |
| Oracle budget | OCI budget alert | Any spend > ₹1 | SEV-2 |
| TLS / domain expiry | Uptime Kuma | < 30 days | SEV-3 |

Alerts go to a Telegram group (free) and email. SEV-1 also calls the owner's phone through Uptime Kuma's notification integration.

## Severity and response

| Severity | Meaning | Response |
|---|---|---|
| SEV-1 | Customers can't order or deliveries are at risk | Respond within 15 minutes, any hour |
| SEV-2 | Degraded, money at risk later, or ops impaired | Respond within 2 hours (same evening) |
| SEV-3 | Minor | Next working day |

## Backups

- **pgBackRest** on VM-DATA: full backup nightly at 01:00 IST, differential every 6 h, continuous WAL archiving.
- Two repositories: Cloudflare R2 (`backups-prod`) and OCI Object Storage, each with its own credentials, both encrypted (AES-256, key in SOPS).
- Retention: 14 daily, 8 weekly, 12 monthly fulls; WAL for point-in-time recovery over the last 14 days.
- R2 media bucket is versioned; deleted objects retained 30 days.
- **Monthly restore test** (1st of the month, 02:00) on the micro VM: restore latest backup, run integrity queries (row counts, ledger balances sum check), report result.

## Deploys

See [Infrastructure → Deploy pipeline](03-infrastructure.md#deploy-pipeline). Rules:

- No production deploys between **21:30 and 23:00 IST** (cutoff window) or **04:30–08:00** (deliveries), except hotfixes for a SEV-1.
- Database migrations are expand/contract: never drop or rename a column in the same release that stops using it.
- Every deploy records the git SHA in `/v1/health/live` and Sentry release.

---

## Runbooks

### API or storefront down

1. Check Uptime Kuma: is it one service or everything?
2. `ssh app` (via Cloudflare Tunnel) → `docker compose ps`. Restart a crashed service: `docker compose up -d api`.
3. If `cloudflared` is down, everything looks down: `docker compose logs cloudflared`, restart it.
4. Check VM-DATA: `docker compose ps` there; Postgres and Valkey must be up.
5. Check disk (`df -h`) and memory (`free -m`) on both VMs.
6. If the VM itself is unreachable: Oracle console → instance status. If stopped or reclaimed, see **Server lost**.
7. While down, Cloudflare serves cached storefront pages; ordering is unavailable. Post a banner via Cloudflare if outage > 15 min.

### Cutoff job failed or late

**Critical: deliveries for tomorrow depend on it.**

1. Admin → Dispatch → Cutoff runs: see the error.
2. Fix the cause (e.g. database unreachable, a bad product config). Most failures are transient; the job retries 3 times automatically.
3. Re-run from Admin → Dispatch → "Re-run cutoff" (or `pnpm --filter api job:cutoff --date 2026-12-02 --slot morning` on VM-APP). Safe to run repeatedly: it never double-charges.
4. Confirm: delivery count and units look like the previous same weekday (±15%).
5. If it can't complete by 23:30: export the previous day's packing lists as a fallback, tell the dairy, and fix charges the next morning with a re-run (charges for already-dispatched deliveries are posted on re-run with the original date).

### Payment webhooks failing

1. Admin → Payments: payments stuck in `pending` > 10 min?
2. Logs: signature failures → check `CASHFREE_SECRET_KEY` and API version config; check the webhook URL in the Cashfree dashboard.
3. The `payments` worker re-checks pending payments with Cashfree every 10 minutes, so customers' top-ups still complete. Confirm it's running.
4. After fixing, replay failed events: Admin → Queues → `payments` → retry failed.

### Database disk filling

1. `df -h` on VM-DATA. Find the cause: WAL piling up (archive failing?) or table growth.
2. If WAL: check `pgbackrest check`; fix archive credentials or network; WAL will drain.
3. Extend the block volume in OCI (within the 200 GB free total) and grow the filesystem.
4. Prune old logs/metrics (Loki and Prometheus retention).

### Server lost (Oracle reclaimed or terminated the VM)

1. Create a new VM (OpenTofu `tofu apply`, or Oracle console) in the same region.
2. Run Ansible: `ansible-playbook -i inventory/prod site.yml --limit data` (or `app`).
3. For VM-DATA: restore Postgres from pgBackRest (R2 repo): `pgbackrest --stanza=main --repo=1 restore`, start Postgres, verify ledger checks.
4. For VM-APP: `docker compose up -d` (builds images from the tagged commit).
5. Re-point Cloudflare Tunnel credentials (stored in SOPS) and verify health.
6. Target: back online in under 2 hours. Then review why it was lost and whether to move to a paid host.

### Move to a new host

Same as **Server lost**, on the new provider's VMs (any Ubuntu 24.04 ARM or x86 VM with Docker). Steps:

1. Provision 2 VMs (or 1 larger) and private networking.
2. Ansible bootstrap.
3. Put the storefront in maintenance mode (Cloudflare rule) at a quiet hour (14:00 IST).
4. Final backup on the old host → restore on the new host.
5. Start services; switch Cloudflare Tunnel to the new host.
6. Remove maintenance mode; watch metrics for an hour.
7. Keep the old host for 7 days, then destroy it.

### Wallet balance mismatch

1. The nightly check lists wallets where cached balance ≠ ledger sum.
2. Never "fix" by editing `balance_paise` directly without understanding why.
3. Investigate the ledger for that wallet (Admin → Customer → Wallet → Ledger).
4. If the ledger is right and the cache wrong: run `pnpm --filter api wallet:rebuild-balance --wallet wlt_…` (recomputes cache from ledger, audited).
5. If the ledger is wrong: post a reversing adjustment with a clear reason. Open an incident to find the bug.

### Secret rotation

| Secret | How |
|---|---|
| JWT signing key | Add new key with new `kid` → deploy → sign with new key → after 30 days remove old key |
| Cashfree secret | Generate new key in Cashfree → update SOPS → deploy → revoke old key |
| Database passwords | `ALTER ROLE … PASSWORD` → update SOPS → rolling restart |
| R2 / OCI keys | Create new key → update → deploy → delete old key |
| Cloudflare Tunnel token | Rotate in Cloudflare → update → restart `cloudflared` |

Rotate all secrets yearly, and immediately when a staff member with server access leaves.

### Security incident or data breach

1. Contain: revoke sessions (Admin → Staff/Customers), rotate secrets, block IPs in Cloudflare.
2. Preserve evidence: snapshot logs, don't wipe servers yet.
3. Assess what data was affected and how many people.
4. Notify affected customers and authorities as required by the DPDP Act.
5. Fix, then write a blameless post-incident review in `docs/incidents/YYYY-MM-DD-title.md`.

## Post-incident review template

```markdown
# YYYY-MM-DD: short title
- Severity:
- Duration: (start → detected → resolved)
- Impact: (customers, orders, money)
- Timeline:
- Root cause:
- What went well / badly:
- Actions: (owner, due date)
```
