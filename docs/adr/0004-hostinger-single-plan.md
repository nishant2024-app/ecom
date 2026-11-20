# ADR 0004: Do not use Hostinger Single shared hosting

- **Status:** Accepted
- **Date:** 2026-11-20

## Context

The owner considered Hostinger's **Single** web hosting plan: ₹2,980.80 for 48 months (₹62.10/month with a coupon, renewing at ₹289/month), with 1 website, a free domain, 10 GB SSD, weekly backups, CDN and a mailbox.

## Findings

| Our requirement | Hostinger Single |
|---|---|
| Node.js / Fastify API | Not available. Hostinger offers Node.js apps only on Business web hosting and Cloud plans. |
| PostgreSQL | Not available (MySQL/MariaDB only on shared hosting) |
| Valkey/Redis, background workers, scheduled cutoff job | Not available |
| Docker | Not available |
| Remotion rendering (headless Chromium) | Not possible |
| Storage | 10 GB |

The plan is designed for WordPress, PHP sites and site-builder sites. It cannot run this project's backend. The only parts we could use (static file hosting, CDN, a domain, a mailbox) are already covered for free by Cloudflare Pages, Cloudflare Email Routing or Zoho Mail's free plan, and a domain bought on its own (~₹700–1,200/year). Hostinger's "free domain" is normally free only for the first year.

## Decision

Don't buy Hostinger Single for this project. Stay on Oracle Always Free + Cloudflare (ADR 0002).

If the owner later prefers a paid host for peace of mind, the right Hostinger product is a **KVM VPS** (2 vCPU / 8 GB, "KVM 2", or larger), which runs our Docker stack unchanged. Check the renewal price, not just the first-term price, before buying.

## Consequences

- No ₹2,980 spend on a plan we can't use.
- Domain and email are handled separately (see docs/03-infrastructure.md).
