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
| POST | `/v1/admin/orders/bulk/pack` | `orders.fulfil` | `{orderIds}` (max 100); returns `{packed, failed[{id, reason}]}`; orders not in `confirmed` are skipped |
| POST | `/v1/admin/orders/packing-slips` | `orders.read` | `{orderIds}`; full order detail for printing packing slips |
| GET | `/v1/admin/orders/export.csv?status=&from=&to=` | `orders.read` | CSV (UTF-8 with BOM, opens in Excel); dates in IST; cells starting with `= + - @` are escaped |
| GET / POST | `/v1/admin/categories` | `catalog.read` / `catalog.write` | Categories with product counts / create `{slug, nameEn, nameHi, blurb?, sort?}` |
| PUT / DELETE | `/v1/admin/categories/{id}` | `catalog.write` | Update / delete (refused with 409 while it has products) |
| GET / POST | `/v1/admin/products` | `catalog.read` / `catalog.write` | List with sizes and stock / create with sizes |
| GET / PUT | `/v1/admin/products/{id}` | `catalog.read` / `catalog.write` | Detail / replace (sizes not listed are archived; price changes also need `pricing.write`) |
| GET | `/v1/admin/products/{id}/media` | `catalog.read` | Product photos in display order; the first is the main image |
| POST | `/v1/admin/products/{id}/media` | `catalog.write` | Upload photos: `multipart/form-data`, field `file` (repeatable), optional `alt`. See [Photos](#photos) |
| PUT | `/v1/admin/products/{id}/media/order` | `catalog.write` | `{ids}`: every photo of the product exactly once, in the new order |
| PATCH / DELETE | `/v1/admin/media/{id}` | `catalog.write` | Edit alt text `{alt}` / delete a product photo (files removed from storage) |
| GET / POST | `/v1/admin/site-media` | `catalog.read` / `catalog.write` | Storefront image library / upload (same rules as product photos) |
| DELETE | `/v1/admin/site-media/{id}` | `catalog.write` | Delete; 409 while the image is used on the storefront |
| GET | `/v1/admin/reviews?status=pending\|approved\|rejected` | `catalog.read` | Reviews with product, customer email and order number, plus counts per status |
| PATCH | `/v1/admin/reviews/{id}` | `catalog.write` | `{status: approved\|rejected}`; audited |
| GET / PUT | `/v1/admin/storefront` | `catalog.read` / `catalog.write` | Home page copy and images: announcement, hero, story, promises, SEO title and description. Image ids must come from the site-media library |
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

## Photos

- Accepted: JPG, PNG, WebP, HEIC/HEIF, AVIF. Up to 20 MB each, at least 400 px wide, at most 10,000 px on a side.
- Each upload is rotated per EXIF, stripped of metadata (including GPS), and stored as WebP at 480, 960 and 1600 px wide (never upscaled). Keys look like `products/{slug}/{mediaId}-960.webp`.
- Storage is Cloudflare R2 when the `R2_*` variables are set (required in production), otherwise the local `MEDIA_DIR`, served by the API at `/media/…`.
- Responses give every image as `{id, url, alt, width, height, srcset: [{url, width}]}`; the storefront catalog uses the same shape for `image` and `gallery`.
- Products without photos show a drawn pack (from the product's `pack` colours) on the storefront, so a product can go on sale before it is photographed.
