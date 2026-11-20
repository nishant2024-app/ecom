# ADR 0007: Shelf-stable products shipped by courier (replaces daily delivery)

- **Status:** Accepted
- **Date:** 2026-11-20
- **Supersedes:** the daily fresh-milk delivery model described in earlier versions of PLAN.md

## Context

The owner clarified that the business sells durable, processed dairy products (ghee, milk powder, UHT and flavoured milk, condensed milk, milk sweets), not daily fresh milk. Products keep for 21–365 days and can be shipped anywhere in India.

## Decision

- Standard e-commerce: cart → checkout → prepaid Cashfree payment → pack → ship by courier → deliver.
- Shipping fees and delivery estimates by **pincode zone** (longest-prefix match), configurable in admin, with free-shipping thresholds and per-kilogram surcharges.
- Stock is **reserved first-expiry-first-out** when an order is placed, released if payment doesn't complete within 30 minutes (configurable), and leaves inventory when the order ships. Stock with less than 7 days of shelf life is never sold.
- Removed: subscriptions, milk calendar, nightly cutoff job, delivery slots and routes, delivery agents, prepaid wallet, PostGIS zones.
- Storefront redesigned as an animated site with drawn pack illustrations; Remotion produces brand and product reels.

## Consequences

- Simpler operations: one fulfilment flow, no 5 AM delivery dependency.
- Courier integration (AWB creation, tracking webhooks) becomes the next operational piece; until then staff enter courier and AWB by hand.
- Refunds go back to the original payment method through Cashfree (no store credit).
- Subscriptions ("monthly ghee refill") can return later as recurring orders on top of the same order flow.
