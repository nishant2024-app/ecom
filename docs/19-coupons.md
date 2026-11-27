# 19 · Coupons

Customers type a code in the cart or at checkout; the server checks it every time the cart is priced, so nothing can be faked from the browser. Staff manage codes in **Admin → Coupons** (creating or editing needs the `pricing.write` permission: Owner, Admin).

## What a coupon can do

| Setting | Meaning |
|---|---|
| Code | 3–24 letters, numbers, `-` or `_`; customers can type it in any case |
| Percent off (with optional "at most ₹") or Rupees off | Comes off the **products**, never shipping, and never more than the products cost |
| Minimum order value | Compared with the products total before the discount. The cart tells the customer how much more to add |
| Starts / ends | Dates in India time; "ends" is valid until the end of that day |
| Total uses | Across all customers. Cancelled and expired orders give the use back |
| Uses per customer | Default 1 |
| First order only | Only customers with no earlier paid order |
| Status | Active or Paused |

The list shows how many times each code was used and how much it gave away.

## How it affects the numbers

- **GST:** prices include GST, so a discount lowers the taxable value. The discount is spread over the order lines in proportion (to the paisa) and GST is recalculated on each discounted line. The order stores `discount`, `couponCode` and the reduced tax.
- **Free shipping:** decided on what the customer pays for products **after** the discount. A ₹580 cart qualifies for free shipping in Pune (threshold ₹499); with a 50% coupon it becomes ₹290 and shipping is charged.
- **Refunds:** cancelling refunds what the customer actually paid, and the coupon use is released.
- **Race safety:** when the order is placed the coupon row is locked and the limits are checked again, so two people cannot take the last use.
- Receipts and emails show the "Coupon CODE −₹X" line.

## API

| Endpoint | Notes |
|---|---|
| `POST /v1/store/checkout/quote` | Optional `couponCode`. Response adds `discount`, `coupon {code, description}` and `couponError` (a plain-language reason, for example "Add ₹10 more to use this code (minimum ₹300)."). A bad code never fails the request |
| `POST /v1/store/orders` | Optional `couponCode`. If it no longer works, `422 COUPON_INVALID` with the reason |
| `GET /v1/admin/coupons` | List with `used` and `discountGivenPaise` |
| `POST /v1/admin/coupons`, `PUT /v1/admin/coupons/{id}` | `pricing.write`. Body: `code, kind (percent\|fixed), percentBps \| amountPaise, maxDiscountPaise?, minSubtotalPaise?, startsAt?, endsAt?, usageLimit?, perCustomerLimit?, firstOrderOnly?, status?, description?`. `409` if the code exists |

Money is in paise; `percentBps` 1000 means 10%.

## Android

Same two calls. Keep the typed code in app state, send it with each quote, and show `couponError` or the `coupon` chip from the response. Do not calculate discounts in the app.

## Not included yet

Coupons for specific products or categories, free-shipping coupons, buy-one-get-one, automatic offers without a code, and referral codes. The structure (one table of rules plus one table of uses) is ready for them.
