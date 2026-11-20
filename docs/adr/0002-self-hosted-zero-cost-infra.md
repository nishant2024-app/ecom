# ADR 0002: Self-host on Oracle Cloud Always Free behind Cloudflare

- **Status:** Accepted
- **Date:** 2026-11-20

## Context

Requirement: zero hosting cost now and later, for 50,000–100,000 users, with a professional setup. Vercel's free Hobby plan forbids commercial use; Supabase's free tier pauses projects after 7 days of inactivity and has small limits.

## Decision

Run the whole stack as Docker containers on **Oracle Cloud Always Free** ARM VMs (app VM + data VM), with **Cloudflare Free** in front (DNS, CDN, WAF, Tunnel, Pages, Access, R2). PostgreSQL, Valkey, workers and the Remotion renderer are self-hosted. Infrastructure is code (OpenTofu + Ansible + Compose). Backups go to R2 and OCI Object Storage.

Size for the smaller reported free allocation (2 OCPU / 12 GB) in case Oracle's 2026 reduction applies. Upgrade the account to Pay-As-You-Go (still ₹0 within free limits) to avoid idle reclamation, with a ₹1 budget alert.

## Alternatives considered

| Option | Why not (for now) |
|---|---|
| Vercel + Supabase free | Commercial use not allowed on Vercel Hobby; Supabase pauses |
| Hostinger Single shared hosting | Can't run Node.js, PostgreSQL or workers (ADR 0004) |
| Hostinger / Hetzner / DigitalOcean VPS | Good, but costs money monthly. Kept as the upgrade path. |
| AWS / GCP free tiers | 12-month trials or tiny always-free instances; costs after |
| Render / Railway / Fly free tiers | Sleep on idle, small limits, or no longer free |

## Consequences

- ₹0 hosting; only the domain costs money.
- No SLA; we own operations (monitoring, backups, updates). Runbooks in docs/11-operations.md.
- Risk that Oracle changes terms. Mitigated by portability: move to any VPS in under 2 hours with no code changes.
