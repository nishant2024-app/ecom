# 06 · Business rules

The rules here are implemented as pure functions in `packages/core` and covered by unit and property-based tests. Values in *italics* are defaults that the owner can change in **Admin → Settings**.

## Time and dates

- All business logic uses `Asia/Kolkata` (IST, UTC+5:30, no daylight saving).
- "Tomorrow" means the next business date in IST, regardless of the server's clock zone.
- A slot's **cutoff** = slot date at slot start time + `cutoff_offset_minutes`. Default: morning slot 05:00–08:00 with cutoff *22:00 the previous day*.
- After the cutoff, customers can't change that date's delivery. Changes apply from the next date.

## Serviceability

1. A customer enters a pincode or drops a map pin.
2. If a pin is given: the zone whose polygon contains the point wins. Otherwise the pincode is looked up in `zone_pincodes`.
3. If a pincode maps to several zones, the address must have a map pin.
4. No zone → `NOT_SERVICEABLE`. The customer can leave their email to be notified when we arrive (stored as a lead).
5. A variant is orderable in a zone only if `zone_availability.available` is true.

## Subscriptions

### Patterns

| Pattern | Delivers on | Quantity |
|---|---|---|
| `daily` | Every day | `quantity` |
| `alternate` | Every second day counted from `anchor_date` | `quantity` |
| `weekdays` | Days with a non-zero entry in `weekday_quantities` | Per weekday, Mon..Sun, e.g. `[1,1,1,1,1,2,2]` |

### What is delivered on date D

For a subscription item on date D, in this order:

1. Subscription not active on D (`starts_on > D`, or `ends_on < D`, or cancelled) → nothing.
2. D falls inside a pause → nothing.
3. D is a holiday for the slot → nothing.
4. An override exists for D → use the override's items (an empty list means skip the day).
5. Otherwise → the pattern's quantity for D.
6. Quantity 0 → nothing.

### Changes

| Action | Rule |
|---|---|
| Create | Earliest start date = the first date whose cutoff hasn't passed. Requires a serviceable default address. |
| Change quantity for one date | Creates or updates an override. Allowed until that date's cutoff. |
| Change the pattern going forward | Applies from the first date whose cutoff hasn't passed. Existing overrides on later dates are kept. |
| Pause | Date range; start date must be after the next cutoff. *Maximum 60 days* per pause. Pauses can overlap; they're merged for display. |
| Resume early | Shortens the pause's `ends_on`, subject to cutoff. |
| Cancel | Effective from the first date whose cutoff hasn't passed. Already generated deliveries stay. |
| Minimum | *No minimum term.* Subscription price (`subscription_price_paise`) applies to subscription deliveries only. |

## Cutoff job

Runs at each slot's cutoff for the next date. Steps, in one logical run (several transactions, all idempotent):

1. **Lock.** Take a Postgres advisory lock on (`seller`, `date`, `slot`) and create/resume a `cutoff_runs` row. A second run waits or exits.
2. **Expand subscriptions** for the date using the rules above.
3. **Collect one-time orders** with status `confirmed` for the date and slot.
4. **Group** by (customer, address) and upsert one `deliveries` row each, with `delivery_items`. Prices come from the variant at this moment (subscription price for subscription items, the order's snapshot for orders).
5. **Charge the wallet** for subscription items (one-time orders were already paid at checkout):
   - Charge = sum of subscription item totals (+ bottle deposit for new bottles if applicable).
   - If `balance − charge ≥ −overdraft_limit` → post a ledger entry with `kind = delivery_charge`, `reference = delivery`. The ledger's unique key means a re-run can't charge twice.
   - Otherwise → subscription items are removed from the delivery and the delivery is marked `skipped_low_balance` if nothing remains. The customer is notified. *If UPI Autopay is active, an auto-recharge is triggered first and the charge retried once.*
6. **Allocate stock** for each delivery item, FEFO (see below). Shortfalls are recorded on the production plan, not refused: dairy is produced to order overnight.
7. **Assign routes.** Each address belongs to a route through `route_stops`. New addresses without a stop are added to the end of the route for their zone and flagged on the dispatch board for re-ordering.
8. **Build the production plan** and packing lists per route.
9. **Mark the run complete** with stats (deliveries, units per variant, charged amount, skipped count).
10. **Notify customers**: "Tomorrow, 5–8 AM: 1 × Toned Milk 500 ml, 1 × Curd 400 g. ₹82 charged. Balance ₹418."

If the job fails, it's retried automatically 3 times with backoff and an alert goes to the owner and dispatch staff. Dispatch can re-run it from the admin. A re-run recomputes deliveries that haven't been dispatched yet and never double-charges.

## Wallet

- One wallet per customer, in INR paise.
- **The balance is the sum of the ledger.** `wallets.balance_paise` is a cache updated in the same transaction as each ledger insert, with `SELECT … FOR UPDATE` on the wallet row. A nightly job checks cache = sum and alerts on mismatch.
- Ledger entries are **double-entry**: every movement posts balancing rows (e.g. top-up: +customer, −cashfree_clearing). An entry group always sums to zero.
- Ledger rows are never edited or deleted. Mistakes are fixed by a reversing entry.

| Event | Customer wallet |
|---|---|
| Top-up paid | + amount |
| Delivery charged at cutoff | − charge |
| Delivery failed, our fault (out of stock, agent missed, damaged) | + full refund, automatic |
| Customer not available / refused | *No refund* (product was dispatched). Support can credit manually. |
| One-time order paid from wallet | − order total at checkout |
| One-time order cancelled before cutoff | + order total |
| Promotion / referral reward | + reward (as `promo`) |
| Staff adjustment | ± amount, reason required, limited by role, audited |
| Bottle deposit | − deposit on first bottle delivery; + refund when bottles are returned and the customer closes the account |

**Limits:** *top-up minimum ₹100, maximum ₹10,000 per top-up, maximum balance ₹20,000.* Wallet balance is not withdrawable to cash except on account closure (refund to source).

**Low balance:** when the balance after tomorrow's projected charge would be below `low_balance_threshold` (*default: 3 days of subscription value*), notify the customer once per day.

## One-time orders

| Status | Meaning | Next |
|---|---|---|
| `pending_payment` | Created, online payment not completed | `confirmed`, `cancelled` (expires after 30 min) |
| `confirmed` | Paid (wallet or online) | `scheduled`, `cancelled` |
| `scheduled` | Included in a delivery by the cutoff job | `out_for_delivery` |
| `out_for_delivery` | Agent started the run | `delivered`, `failed` |
| `delivered` | Done | `refunded` (partial or full, by support) |
| `failed` | Not delivered | `refunded` |
| `cancelled` | Cancelled before cutoff | — |

- Delivery date must be a date whose cutoff hasn't passed, a slot day, not a holiday, and within *14 days*.
- *Minimum order value ₹0* if the customer has an active subscription on that date (it rides along), otherwise *₹99*.
- Payment is either from the wallet (instant) or online through Cashfree.

## Deliveries

| Status | Set by |
|---|---|
| `scheduled` | Cutoff job |
| `packed` | Dispatch (bulk, per route) |
| `out_for_delivery` | Agent starts the run |
| `delivered` | Agent |
| `not_available` | Agent (nobody home, no instructions) |
| `refused` | Agent |
| `missed` | Agent or dispatch (our fault: ran out, couldn't reach) |
| `skipped_low_balance` | Cutoff job |
| `cancelled` | Staff |

Proof of delivery: optional photo (*required for `not_available`*), timestamp and agent ID. Customers see the status live and get a push notification on `delivered`.

## Stock and batches

- Stock is tracked per **batch** (manufacture date, expiry date).
- **FEFO:** allocation takes the batch with the earliest `expires_on` first, skipping batches that would expire before the delivery date + *1 day* of customer shelf life.
- Movements: `produced` (+), `reserved` (at cutoff), `dispatched` (when the run starts), `returned`, `wasted` (−, reason required), `adjusted` (±, reason required).
- Near-expiry alert: batches expiring within *1 day* with stock on hand.
- **Production plan** for date D: required units per variant from deliveries + *5% buffer* − available stock on hand that will still be in date.

## Pricing and GST

- Prices are **GST-inclusive** (B2C retail).
- Each variant has an `hsn_code` and `gst_rate_bps`. Rates are configured in admin, not hard-coded, because dairy rates differ by product and changed in 2025. **Confirm every rate with the business's chartered accountant before launch.**
- Tax is back-calculated per line: `taxable = round(line_total × 10000 / (10000 + rate_bps))`, `tax = line_total − taxable`. Intra-state supply splits tax equally into CGST and SGST; inter-state uses IGST (not expected for local delivery).
- **Invoices:** one per delivery (and per one-time order not delivered with a subscription). Document type depends on the lines: tax invoice (all taxable), bill of supply (all exempt, e.g. fresh milk), or invoice-cum-bill of supply (mixed). Numbering is sequential per financial year (April–March), at most 16 characters: `INV/26-27/000123`.
- The **monthly statement** summarises deliveries, charges, top-ups and refunds. It is not a tax invoice; it links to the invoices.

## Coupons and referrals

- Coupons apply to one-time orders and first subscription weeks. Types: percent, fixed amount, free item, first-order. Conditions: minimum value, categories, zones, new customers only, date range, usage limits.
- One coupon per order. Coupons never reduce a line below ₹0 and never apply to bottle deposits.
- **Referral:** referrer and new customer each get *₹50* wallet credit after the new customer's *first 5 delivered days*. Self-referral detection: same address or same device blocks the reward.

## Bottles

- Variants with `packaging = bottle` carry a deposit.
- First delivery of a bottle variant charges the deposit once per bottle in circulation for that customer.
- Agents record bottles collected at each stop. The customer's bottle balance = given − returned.
- If the balance exceeds *4 bottles*, the agent sees a reminder; no automatic charge.

## Notifications

| Event | Channel |
|---|---|
| Tomorrow's delivery summary (after cutoff) | Push |
| Delivered | Push |
| Not delivered / skipped for low balance | Push + email |
| Low balance | Push (max once a day) |
| Top-up success | Push |
| Monthly statement | Email + push |
| Invoice | In account; email only on request (saves free email quota) |
| Cutoff reminder (opt-in) | Push, 1 hour before cutoff |

Customers choose language (English or Hindi) and can turn off marketing notifications at any time. Transactional notifications can't be turned off, but push permission is up to the device.
