# 16 · Exact delivery location

Customers can pin their door on a map so the delivery partner can navigate straight to it. The same API serves the website and the future Android app.

## How it works for the customer

1. **Add address** (account page or checkout) shows a map first.
2. **"Use my current location"** asks the browser or phone for permission (it is never requested on page load). The map jumps to the GPS point and draws the accuracy circle.
3. The customer can **drag the map** until the centre pin is on their building. If GPS accuracy is worse than 100 m the form says so and asks them to adjust.
4. The server looks up the pin (`GET /v1/store/geo/reverse`) and **suggests** street/area, city and pincode. It only fills fields the customer has not typed, and warns if the typed pincode differs from the map's.
5. The customer adds flat/floor/building, landmark and a label (Home, Work, Other) and saves.

Sharing the location is optional. Without it, the typed address is used as before.

## What the delivery side sees

- **Admin → Order → Ship to:** a green "Open exact location in Google Maps" button (turn-by-turn directions) with the source (`GPS ±18 m` or `map pin`). Orders without a pin say so.
- **Packing slip:** a QR code the courier scans to open the same directions.
- **CSV export:** a `Map` column with the directions link.
- The location is **copied into the order** (`orders.shipping_address.location`) when it is placed, so later address edits never change an order that is already on its way.

## API

| Endpoint | Notes |
|---|---|
| `POST /v1/store/me/addresses`, `PATCH /v1/store/me/addresses/{id}` | Body accepts `location: {lat, lng, accuracyM?, source: "device" \| "map_pin"}`; `null` clears it; omitted leaves it unchanged. Rejected with 400 when outside India. Coordinates are stored with 6 decimals (about 11 cm) |
| `GET /v1/store/me/addresses` | Each address has `location: {lat, lng, accuracyM, source, directionsUrl} \| null` |
| `GET /v1/store/geo/reverse?lat=&lng=` | Customer sign-in required, 15 requests/min. Returns `{area, city, state, pincode, label, provider}` suggestions (nulls when unknown). `503 GEOCODER_UNAVAILABLE` if the lookup service is down; the client should fall back to typing |
| Order detail (customer and admin) | `shippingAddress.location` with `directionsUrl` |

Database: `addresses.latitude`, `longitude`, `location_accuracy_m`, `location_source`, with checks that both coordinates are present together and inside India's bounding box. Core helpers: `isInIndia`, `roundCoord`, `directionsUrl` in `packages/core/src/geo.ts`.

## Android app

Use the same endpoints. On the phone:

1. Declare `ACCESS_FINE_LOCATION` and `ACCESS_COARSE_LOCATION`; ask for permission **in context** (when the customer taps "Use my current location"), with a short rationale. Handle "approximate only" and "denied" by showing the map.
2. Get one fix with `FusedLocationProviderClient.getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, …)`. Send `source: "device"` and `accuracyM = location.accuracy`.
3. Show a map (Google Maps SDK or MapLibre) with a fixed centre pin and let the customer drag. Send `source: "map_pin"` after a drag.
4. Call `GET /v1/store/geo/reverse` (debounced about 600 ms after the map stops) to prefill the form.
5. Play Console **Data safety**: declare *Approximate location* and *Precise location*, collected for delivery, shared with the courier. Add it to the privacy policy.

Do not collect location in the background and do not send it for anyone who has not chosen to share it.

## Privacy

- Precise location is **personal data**. It is collected only when the customer taps the button or moves the pin, saved with their address, and shown only to staff who can see that order.
- It is deleted with the address or when the customer deletes their account (orders keep the delivery point as part of the tax record, anonymised like other order data).
- The [privacy policy](../apps/web/src/lib/legal.ts) states that precise location is collected for delivery.

## Map and lookup providers (cost and scale)

| Part | Default | Limits | When traffic grows |
|---|---|---|---|
| Map tiles (browser) | OpenStreetMap public tiles through Leaflet | Fair-use only; not for heavy traffic | Set `NEXT_PUBLIC_MAP_TILES_URL` (and `NEXT_PUBLIC_MAP_ATTRIBUTION`) to a tile host with a free tier or your own, e.g. Protomaps PMTiles on Cloudflare R2, MapTiler, Stadia |
| Reverse lookup (server) | Nominatim public server | Max 1 request/second, must identify the app, results cached 30 days per ~11 m cell | Self-host Nominatim (India extract, about 2–4 GB RAM) and set `GEOCODER_URL`; or `GEOCODER_URL=off` to disable suggestions |
| Directions for couriers | Google Maps links (free, opens the app) | none | no change |

Environment variables: `GEOCODER_URL`, `GEOCODER_EMAIL` (contact address required by Nominatim's policy), `NEXT_PUBLIC_MAP_TILES_URL`, `NEXT_PUBLIC_MAP_ATTRIBUTION`. At 50–100k users the public servers will not be enough, so plan to switch the first two before launch day marketing. The lookup is behind a small interface (`apps/api/src/services/geocoder.ts`), so a different provider is a one-file change.

## Known limits

- GPS indoors or in dense areas can be 50–200 m off; that is why the pin can be dragged and the accuracy is shown to staff.
- OpenStreetMap postcode data in India is sometimes wrong, so the pincode is a suggestion the customer confirms.
- The geolocation permission prompt only works on **https** (or `localhost`), so the production site must be served over HTTPS (it is, behind Cloudflare).
