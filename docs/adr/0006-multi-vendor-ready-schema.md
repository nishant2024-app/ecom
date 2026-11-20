# ADR 0006: Multi-vendor-ready schema from day one

- **Status:** Accepted
- **Date:** 2026-11-20

## Context

The business is a single brand now but may become a multi-vendor marketplace later. Retrofitting seller ownership into a live database is painful.

## Decision

- A `sellers` table exists from the start, with one seeded seller.
- Every seller-owned row (products, variants, batches, order items) has `seller_id`.
- Every order produces `seller_orders` (the fulfilment unit), even though there's only one seller.
- Staff can be scoped to a seller (`staff.seller_id`); platform staff have `null`.
- `/v1/seller/*` is reserved in the API.

## Not built now

Seller onboarding and KYC, seller panel, commission rules, Cashfree Easy Split payouts, per-seller shipping. These are additive when needed.

## Consequences

- Slightly more columns and joins today.
- Switching on marketplace mode later needs new screens and payout logic, not a data migration.
