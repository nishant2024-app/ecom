# 03 · Infrastructure

## Summary

The shop runs on **one Linux VPS** with Docker Compose: PostgreSQL, Valkey, the API, the background worker, the storefront and the admin's static files. Host **Nginx** terminates HTTPS (Let's Encrypt) and routes by hostname. Product photos go to **Cloudflare R2** (free tier) or to the server's disk. Everything is plain Docker, so it moves to any provider without code changes.

The step-by-step guide is [DEPLOYMENT.md](../DEPLOYMENT.md). The architecture is in [ARCHITECTURE.md](../ARCHITECTURE.md). Decision records: [ADR 0002](adr/0002-self-hosted-zero-cost-infra.md) (why self-host), [ADR 0004](adr/0004-hostinger-single-plan.md) (why not shared hosting).

## What runs where

| Piece | Where | Reached through |
|---|---|---|
| Nginx + Let's Encrypt | Host (apt packages) | Ports 80 and 443, the only public ports |
| Shop (Next.js) | Container `web`, `127.0.0.1:3000` | Nginx: `example.in`, `www.example.in` |
| API (Fastify) | Container `api`, `127.0.0.1:4000` | Nginx: `api.example.in` |
| Admin (static) | Container `admin`, `127.0.0.1:8080` | Nginx: `admin.example.in` |
| Worker | Container `worker` (same image as the API) | internal |
| PostgreSQL 17, Valkey 8 | Containers with volumes `pgdata`, `valkeydata` | internal |
| Photos | Cloudflare R2 bucket (recommended) or volume `media` | `media.example.in` or `api.example.in/media` |
| Backups | `/opt/dairy/backups` + private R2 bucket | `scripts/backup.sh` (cron) |

Files: `infra/compose/single.yml` (production), `infra/compose/dev.yml` (local), `infra/nginx/` (reverse proxy), `infra/cloudflared/` (optional tunnel notes), `scripts/deploy.sh`, `backup.sh`, `restore.sh`.

## Hosting options compared

| | **VPS + Nginx (this guide)** | Oracle Cloud Always Free VPS | Shared hosting (e.g. Hostinger Single) | Vercel + Supabase free |
|---|---|---|---|---|
| Cost | About ₹500–900 a month | ₹0 (domain only) | Cheap | ₹0, but Vercel Hobby forbids commercial use |
| Runs Node, Docker, workers | Yes | Yes | **No** | Serverless only |
| PostgreSQL | Yes (container) | Yes | **No** (MySQL only) | Pauses after 7 idle days |
| Fit | **Recommended**: simple, predictable | Works with the same compose file (ARM is fine); free-tier terms and idle reclamation are the risk | Cannot run this project | Terms and limits rule it out |

Hetzner, DigitalOcean, Vultr, Hostinger KVM and similar all work. Choose Ubuntu 24.04 with 2 vCPU and 4 GB RAM or more.

## Free services used

| Service | Used for | Required? |
|---|---|---|
| Let's Encrypt | HTTPS certificates | Yes (free) |
| Google Identity | Sign-in | Yes (free) |
| Cashfree | Payments (per-transaction fee) | Yes |
| Cloudflare R2 | Photos and backups (generous free tier) | Recommended |
| Resend or Brevo | Order emails (free tiers) | Optional |
| OpenStreetMap tiles + Nominatim | Map and address lookup (light use only) | Yes, replace before heavy traffic ([docs/16](16-location-and-delivery.md)) |
| Cloudflare (DNS, CDN, Tunnel) | Optional in front of Nginx, or instead of it | Optional |

## Environments

| Environment | Purpose | How |
|---|---|---|
| `local` | Development | `pnpm dev` with Docker Postgres ([DEVELOPMENT.md](../DEVELOPMENT.md)) |
| `staging` | Test before release with Cashfree sandbox | A second server or subdomain with `APP_ENV=staging`, `SITE_NOINDEX=true` |
| `production` | Real customers | `APP_ENV=production`; strict start-up checks apply |

## Deploy pipeline

CI (`.github/workflows/ci.yml`) runs lint, format check, typecheck, tests, the contrast check, the OpenAPI freshness check and production builds on every pull request. Deploying is manual and deliberate: SSH to the server and run `scripts/deploy.sh` (backup, pull, build, migrate, restart, health check). See [DEPLOYMENT.md](../DEPLOYMENT.md#14-running-it-day-to-day). Migrations only add things, so the previous version still works after a rollback.

## Capacity

Sized for about 100,000 registered users (roughly 15,000 daily active, 450,000 API requests a day, peaks of 75 to 100 requests a second on sale days). Fastify with cached catalogue reads handles this on 2 vCPU. Postgres grows by roughly 5 to 10 GB in two years. This is an estimate from the design, **not a measured load test**: run one (for example with k6) on your server before a big campaign.

When you outgrow one server: add API containers behind an Nginx `upstream` (the API is stateless), move PostgreSQL to a managed database (change `DATABASE_URL`), and keep photos on R2.

## Costs

A fuller, plain-language version with current prices is [20 · Hosting and costs](20-hosting-and-costs.md).

| Item | Cost | When |
|---|---|---|
| Domain | About ₹700–1,200 a year | Now |
| VPS | About ₹500–900 a month (₹0 on Oracle Always Free) | Monthly |
| HTTPS, R2 free tier, email free tier | ₹0 | — |
| Cashfree | Per-transaction fee deducted from settlements | Per payment |
| Courier | Per parcel | Per order shipped |
| Remotion | ₹0 while the company has 3 people or fewer | Re-check if the team grows |

## Not implemented (ideas for later)

Infrastructure-as-code (OpenTofu, Ansible), WAL archiving with point-in-time recovery, automated staging deploys from GitHub Actions, load testing in CI, and error tracking (Sentry). None is needed to launch.
