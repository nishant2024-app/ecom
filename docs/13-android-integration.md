# 13 · Android integration (later phase)

The Android app uses the same public `/v1` API as the website; no backend changes are needed. The Google Play Console account already exists.

**Technology:** React Native (Expo) is recommended for this TypeScript team (shares types and the API client); Kotlin + Jetpack Compose is a fine alternative.

## Sign in with Google

1. In the same Google Cloud project as the web client, create an **Android OAuth client** with the package name and the SHA-1 of the Play App Signing key (Play Console → *Test and release → App integrity*), the upload key and the debug key.
2. `POST /v1/auth/nonce` → nonce.
3. Credential Manager `GetGoogleIdOption` with **`serverClientId` = the web client ID** and the nonce → Google ID token.
4. `POST /v1/auth/google {idToken, client: "android", deviceName}` → `{user, accessToken, refreshToken, expiresIn}`.

Keep the access token in memory and send `Authorization: Bearer …` plus `X-Client: android/<version> (<code>)`. Store the refresh token encrypted (Android Keystore). On `401 AUTH_TOKEN_EXPIRED`, call `POST /v1/auth/refresh {refreshToken}` once (serialise concurrent refreshes), save the new refresh token, retry. On `AUTH_REFRESH_INVALID` / `AUTH_REFRESH_REUSED`, sign out.

## Shopping flow

| Screen | API |
|---|---|
| Home / shop | `GET /v1/store/categories`, `GET /v1/store/products?featured=true` |
| Product | `GET /v1/store/products/{slug}`, `GET /v1/store/shipping/estimate?pincode=` |
| Cart | Local cart; `POST /v1/store/checkout/quote {lines, pincode}` for prices, stock and shipping |
| Addresses | `GET/POST /v1/store/me/addresses` |
| Checkout | `POST /v1/store/orders` with `Idempotency-Key` → `payment.paymentSessionId` |
| Pay | Cashfree Android SDK with `paymentSessionId`; then poll `GET /v1/store/orders/{id}` until not `pending_payment` (never trust the SDK result alone) |
| Orders | `GET /v1/store/orders`, `GET /v1/store/orders/{id}`, `POST …/cancel`, `POST …/pay` |

Reuse the same `Idempotency-Key` when retrying a timed-out "place order".

## Other

- **Push:** register FCM tokens with `POST /v1/store/me/devices` (order shipped / delivered notifications are a next step on the server).
- **App config:** `GET /v1/app-config` on start; if `versionCode < minVersions.android`, show a blocking update screen. Any endpoint may return `426 APP_VERSION_UNSUPPORTED`.
- **Deep links:** App Links for `/p/{slug}`, `/orders/{id}`; `assetlinks.json` served by the storefront.
- **Play requirements:** in-app account deletion (`DELETE /v1/store/me`) and the web URL `https://example.in/account/delete`; privacy policy; Data safety form (name, email, phone, address, purchase history; shared with Cashfree and the courier); physical goods may use Cashfree (Play Billing applies to digital goods only).
- **Client generation:** `openapi-generator-cli generate -g kotlin -i docs/api/openapi.json` (Kotlin) or `openapi-typescript` (Expo).
