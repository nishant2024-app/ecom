# 01 · Overview

## What we are building

A direct-to-customer dairy business, online. Customers in serviceable areas order milk and dairy products for early-morning doorstep delivery, either as a **recurring subscription** (for example 1 litre of toned milk every day) or as **one-time orders** added to a delivery date. Payments go through **Cashfree** in INR, mostly by topping up a **prepaid wallet** that is debited for each delivery.

The platform has five parts:

| Part | Who uses it | Technology | Hosted at |
|---|---|---|---|
| Storefront | Customers on phone and desktop browsers | Next.js (self-hosted), installable PWA | `example.in` |
| Admin panel | Owner and staff | Vite + React single-page app | `admin.example.in` (Cloudflare Pages) |
| Delivery agent app | Delivery staff on their phones | PWA, works offline | `agent.example.in` |
| Public API | All of the above, plus the future Android app | Fastify (Node.js) | `api.example.in` |
| Video renderer | Background worker | Remotion | Internal only |

## Scope

### In scope for launch

- Single brand, single seller (the schema supports more sellers later; see [ADR 0006](adr/0006-multi-vendor-ready-schema.md))
- English and Hindi
- Google Sign-In for everyone (customers, staff, agents). No SMS. See [ADR 0003](adr/0003-google-only-login.md)
- Pincode and map-pin serviceability check
- Daily, alternate-day and weekday subscriptions; vacation pauses; per-date changes
- One-time orders on a chosen delivery date and slot
- Prepaid wallet with Cashfree top-ups and optional UPI Autopay auto-recharge
- Morning delivery slot (evening slot configurable)
- Batch and expiry tracking, first-expiry-first-out allocation, wastage
- Daily production plan, dispatch board, route sheets
- Delivery agent PWA with offline support and proof of delivery
- Glass bottle deposits and returns
- GST-compliant invoices and monthly statements
- Admin with role-based access and an audit log
- Notifications: web push, email for invoices and statements
- Generated videos: product reels, monthly customer recap, festival campaigns

### Later

- Android app (the Google Play Console account already exists). The API is built for it from day one; see [Android integration](13-android-integration.md)
- Multi-vendor marketplace (seller onboarding, Cashfree Easy Split payouts)
- More languages
- Cash on delivery (deliberately not offered at launch: prepaid wallet only)

### Not planned

- SMS or WhatsApp OTP login
- Courier shipping outside our own delivery zones

## Users

| Persona | Needs |
|---|---|
| **Household customer** | Reliable morning milk without thinking about it. Change tomorrow's order fast. See what they're paying. Often uses a low-end Android phone; may prefer Hindi. |
| **Occasional customer** | Order paneer, curd or ghee for a specific day. |
| **Owner** | Know tomorrow's production volume tonight. See revenue, wallet float, churn. Trust that nothing is lost. |
| **Operations / dispatch staff** | Packing lists and route sheets at cutoff. Handle missed deliveries and complaints. |
| **Delivery agent** | An ordered list of stops that works with poor network. One tap per stop. |
| **Support staff** | Look up a customer, pause or credit them, see their history. |
| **Accountant** | GST reports by HSN code, invoices, reconciliation with Cashfree settlements. |

## Glossary

| Term | Meaning |
|---|---|
| **Business date** | A calendar date in India Standard Time (`Asia/Kolkata`). All delivery dates are business dates. |
| **Slot** | A delivery window on a business date, e.g. *Morning 05:00–08:00*. |
| **Cutoff** | The moment after which tomorrow's deliveries for a slot are locked, e.g. 22:00 the night before. Customers can change orders until the cutoff. |
| **Cutoff job** | The background job that runs at cutoff: turns subscriptions and one-time orders into deliveries, debits wallets, reserves stock, builds route sheets. |
| **Subscription** | A standing order that repeats on a pattern (daily, alternate days, chosen weekdays). |
| **Pause** | A date range during which a subscription delivers nothing (vacation). |
| **Override** | A change to one subscription for one date only (e.g. 2 L instead of 1 L on Sunday). |
| **Delivery** | Everything one customer receives at one address in one slot on one date. One row per customer × address × date × slot. |
| **Run** | One agent's route on one date and slot. |
| **Stop** | One delivery within a run. |
| **Wallet** | A customer's prepaid balance in INR. |
| **Ledger** | The append-only record of every wallet movement. The balance is always the sum of the ledger. |
| **Top-up** | Adding money to the wallet through Cashfree. |
| **UPI Autopay** | A recurring UPI mandate the customer approves once; we use it to auto-recharge the wallet when it runs low. |
| **Overdraft limit** | How far below zero a wallet may go before subscriptions are skipped (configurable, default ₹0). |
| **Batch** | A production lot of a product variant with manufacture and expiry dates. |
| **FEFO** | First-expiry-first-out: stock with the nearest expiry date is allocated first. |
| **Wastage** | Stock written off (expired, damaged, returned). |
| **Production plan** | Total units per variant needed for a date, from deliveries plus a buffer. |
| **SNF** | Solids-not-fat: a milk quality measure shown on product pages along with fat %. |
| **HSN code** | The tax classification code for a product under GST. Each variant has one. |
| **FSSAI** | Food Safety and Standards Authority of India. The licence number must appear on the site. |
| **Paise** | 1/100 of a rupee. All money in the system is stored and sent as integer paise. |
| **Seller** | The business that owns products and fulfils orders. One seller at launch. |
| **Hisaab** | Hindi for "account": the customer's monthly statement view. |
