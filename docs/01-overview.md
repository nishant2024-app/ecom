# 01 · Overview

## What we are building

An online shop for **shelf-stable dairy products** from our farm in Mulshi, Pune: bilona ghee, milk powder, UHT and flavoured milk, sweetened condensed milk and milk sweets (mithai). Products keep for 21 days to 12 months, so they ship by courier to any serviceable pincode in India. Customers pay online through **Cashfree** in INR.

| Part | Who uses it | Technology | Hosted at |
|---|---|---|---|
| Storefront | Customers | Next.js (self-hosted), animated with Motion | `example.in` |
| Admin panel | Owner and staff | Vite + React SPA | `admin.example.in` (Cloudflare Pages + Access) |
| Public API | Storefront, admin, future Android app | Fastify | `api.example.in` |
| Worker | Background | Same codebase as the API | Internal |
| Video | Content staff, build pipeline | Remotion | Renders to files |

## Scope at launch

- Single brand, single seller (schema ready for more: [ADR 0006](adr/0006-multi-vendor-ready-schema.md))
- English, with Hindi product names and search terms (doodh, ghi, pedha)
- Google Sign-In for customers and staff ([ADR 0003](adr/0003-google-only-login.md))
- Catalog with sizes, live stock, shelf life, nutrition, FSSAI and HSN details
- Pincode delivery estimate and fee on the product page, cart and checkout
- Cart → checkout → Cashfree payment (UPI, cards, net banking)
- Order tracking with timeline; cancel and full refund until packed
- Admin: dashboard, orders (pack, ship with AWB, deliver, cancel/refund), products, inventory by batch, customers, shipping zones, staff and roles, audit log
- Generated brand reel (Remotion) on the home page

## Later

Courier API integration (AWB + tracking), GST invoice PDFs, order emails, coupons, returns and partial refunds, recurring orders, more languages, Android app.

## Users

| Persona | Needs |
|---|---|
| **Home cook** | Real ghee and milk products that last, delivered without a trip to the store. Clear delivery date and price before paying. |
| **Gift buyer** | Mithai and ghee sent to family in another city. |
| **Owner** | Revenue, what to pack today, what's running low or expiring. |
| **Warehouse staff** | A list of paid orders to pack, a way to record courier and AWB. |
| **Support** | Find an order by name, phone, pincode or AWB; cancel and refund. |
| **Accountant** | Sales by product and GST; payment status. |

## Glossary

| Term | Meaning |
|---|---|
| **Business date** | A calendar date in India Standard Time (`Asia/Kolkata`). |
| **Variant / size** | One sellable pack of a product, e.g. *A2 Gir Cow Ghee 500 ml*, with its own SKU, price and weight. |
| **Batch** | A production lot of a variant with manufacture and expiry dates and a printed code. |
| **FEFO** | First-expiry-first-out: orders take stock from the batch that expires first. |
| **Reserved stock** | Units held for orders that are placed but not yet shipped. |
| **Available** | On hand − reserved, counting only batches with at least 7 days of shelf life left. |
| **Shipping zone** | A set of pincode prefixes with a fee, free-shipping threshold, weight surcharge and delivery days. |
| **AWB** | Air waybill: the courier's tracking number. |
| **Payment window** | Time a placed order waits for payment before it closes and releases stock (default 30 minutes). |
| **HSN code** | Tax classification code for GST, per variant. |
| **FSSAI** | Food Safety and Standards Authority of India; the licence number is shown on the site. |
| **Paise** | 1/100 of a rupee. All money is stored and sent as integer paise. |
