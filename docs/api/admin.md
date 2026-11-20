# Admin endpoints

Staff only (`client: "admin"` sign-in). Each endpoint requires the permission shown ([roles](../04-authentication.md#roles-and-permissions)). Every write is recorded in the audit log. Full schemas: [openapi.json](openapi.json).

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/v1/admin/me` | any staff | Profile and permission list (drives the admin navigation) |
| GET | `/v1/admin/dashboard?days=7` | `dashboard.read` | Revenue (with change vs previous period), paid orders, average order, daily series, orders by status, to-pack/to-ship counts, top products, low stock, batches expiring in 30 days, recent orders |
| GET | `/v1/admin/orders` | `orders.read` | Filter by `status`; search `q` (number, name, phone, pincode, AWB); counts per status; cursor |
| GET | `/v1/admin/orders/{id}` | `orders.read` | Detail with customer, events, payment, refunds |
| POST | `/v1/admin/orders/{id}/pack` | `orders.fulfil` | confirmed → packed |
| POST | `/v1/admin/orders/{id}/ship` | `orders.fulfil` | packed → shipped `{courier, trackingNumber, trackingUrl?}`; stock leaves inventory |
| POST | `/v1/admin/orders/{id}/deliver` | `orders.fulfil` | shipped → delivered |
| POST | `/v1/admin/orders/{id}/cancel` | `orders.refund` | `{reason}`; before shipping; releases stock and refunds the payment |
| GET | `/v1/admin/categories` | `catalog.read` | Categories |
| GET / POST | `/v1/admin/products` | `catalog.read` / `catalog.write` | List with sizes and stock / create with sizes |
| GET / PUT | `/v1/admin/products/{id}` | `catalog.read` / `catalog.write` | Detail / replace (sizes not listed are archived; price changes also need `pricing.write`) |
| GET | `/v1/admin/inventory` | `catalog.read` | Per size: on hand, reserved, available, reorder level, next expiry, batch count |
| GET | `/v1/admin/batches?variantId=` | `catalog.read` | Batches (first to expire first) and recent stock movements |
| POST | `/v1/admin/batches` | `inventory.write` | Record production `{variantId, code, manufacturedOn, expiresOn, quantity}` |
| POST | `/v1/admin/stock/adjustments` | `inventory.write` | `{batchId, delta, kind: adjusted|wasted|returned, reason}`; can't go below reserved |
| GET | `/v1/admin/customers?q=` | `customers.read` | Customers with paid order count and total spent |
| GET | `/v1/admin/customers/{id}` | `customers.read` | Addresses and orders |
| GET | `/v1/admin/shipping-zones` | `catalog.read` | Zones |
| PUT | `/v1/admin/shipping-zones/{code}` | `settings.write` | Update prefixes, fee, free-above, weight rules, delivery days, serviceable |
| GET / POST | `/v1/admin/staff` | `staff.manage` | Team / invite by Google email with a role |
| PATCH | `/v1/admin/staff/{id}` | `staff.manage` | Change role or deactivate (revokes their sessions); not yourself |
| GET | `/v1/admin/audit-log?entityId=` | `audit.read` | Recent staff actions with before/after |
