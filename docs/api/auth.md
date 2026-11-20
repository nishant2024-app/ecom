# Auth and meta endpoints

Conventions (errors, headers, money, dates): [API guide](README.md). Design: [Authentication](../04-authentication.md).

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/v1/auth/nonce` | Public | Get a single-use nonce for Google sign-in |
| POST | `/v1/auth/google` | Public | Exchange a Google ID token for our session |
| POST | `/v1/auth/refresh` | Refresh token | Rotate tokens |
| POST | `/v1/auth/logout` | Any | End the current session |
| GET | `/v1/auth/sessions` | Any | List my sessions (devices) |
| DELETE | `/v1/auth/sessions/{sessionId}` | Any | Sign out one device |
| POST | `/v1/auth/totp/setup` | Staff | Start TOTP enrolment |
| POST | `/v1/auth/totp/verify` | Staff | Verify a TOTP code (enrolment or sign-in) |
| GET | `/v1/auth/.well-known/jwks.json` | Public | Public keys for our access tokens |
| GET | `/v1/app-config` | Public | Minimum app versions, feature flags, support info |
| GET | `/v1/health/live` | Public | Process is up |
| GET | `/v1/health/ready` | Public | Process can serve (DB and Valkey reachable) |

---

## POST /v1/auth/nonce

Returns a nonce to pass to Google when requesting the ID token. Valid for 5 minutes, usable once.

```http
POST /v1/auth/nonce
```

```json
200 OK
{ "nonce": "n_7bq2Jc0X3s9mVxK1", "expiresAt": "2026-12-01T16:35:00Z" }
```

## POST /v1/auth/google

```http
POST /v1/auth/google
Content-Type: application/json

{
  "idToken": "eyJhbGciOiJSUzI1NiIsImtpZCI6…",
  "client": "web",
  "deviceName": "Chrome on Android"
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `idToken` | string | yes | From Google Identity Services (web) or Credential Manager (Android) |
| `client` | `web` · `admin` · `agent` · `android` | yes | Decides which account type to sign into and how tokens are returned |
| `deviceName` | string ≤ 80 | no | Shown in the sessions list |

**Response (web, admin, agent):** tokens are set as cookies (`access_token`, `refresh_token`, `csrf_token`); the body contains the user.

```json
200 OK
{
  "user": {
    "type": "customer",
    "id": "cus_01JD3K8Q2V7M4X9TB6N5R1ZC0P",
    "name": "Asha Verma",
    "email": "asha@example.com",
    "phone": null,
    "language": "en",
    "profileComplete": false
  },
  "isNewUser": true,
  "expiresIn": 900
}
```

**Response (android):** same body, plus tokens:

```json
{
  "user": { "…": "…" },
  "isNewUser": false,
  "accessToken": "eyJhbGciOiJFZERTQSIsImtpZCI6ImsxIn0…",
  "refreshToken": "rt_Yk2d0b2Jm9…",
  "expiresIn": 900
}
```

For `client: "admin"`, if the staff role requires TOTP, the response is `200` with `"totpRequired": true` and a short-lived pre-auth cookie/token; call `/v1/auth/totp/verify` to finish.

**Errors:** `AUTH_INVALID_GOOGLE_TOKEN`, `AUTH_NONCE_INVALID`, `STAFF_NOT_ALLOWED` (admin/agent), `RATE_LIMITED`.

## POST /v1/auth/refresh

Web clients send nothing (refresh cookie is used). Android sends the refresh token:

```json
{ "refreshToken": "rt_Yk2d0b2Jm9…" }
```

Returns new tokens in the same way as sign-in. The old refresh token stops working immediately.

**Errors:** `AUTH_REFRESH_INVALID`, `AUTH_REFRESH_REUSED` (whole session revoked; sign in again).

## POST /v1/auth/logout

Ends the current session and clears cookies. `204 No Content`.

## GET /v1/auth/sessions

```json
200 OK
{
  "data": [
    {
      "id": "ses_01JD3K…",
      "client": "android",
      "deviceName": "Redmi Note 13",
      "createdAt": "2026-11-02T03:11:00Z",
      "lastUsedAt": "2026-12-01T16:20:00Z",
      "current": true
    }
  ]
}
```

## DELETE /v1/auth/sessions/{sessionId}

Signs out that device. `204 No Content`.

## POST /v1/auth/totp/setup

Staff only, while signed in. Returns an `otpauth://` URI (show as QR) and recovery codes (shown once).

```json
200 OK
{ "otpauthUri": "otpauth://totp/Dairy:owner%40example.in?secret=…&issuer=Dairy", "recoveryCodes": ["4f9k-2m8q", "…"] }
```

## POST /v1/auth/totp/verify

```json
{ "code": "492817" }
```

`200` with the full session on success. `401 AUTH_TOTP_REQUIRED` with `detail` on a wrong code. Five wrong codes lock TOTP for 15 minutes.

## GET /v1/app-config

Public, cacheable. Clients call it on start.

```json
200 OK
{
  "minVersions": { "android": 1, "web": "1.0.0" },
  "latestVersions": { "android": 1 },
  "features": { "eveningSlot": false, "autopay": true, "referrals": true },
  "support": { "phone": "+911234567890", "email": "support@example.in", "whatsapp": null },
  "legal": { "fssai": "12345678901234", "privacyUrl": "https://example.in/privacy", "termsUrl": "https://example.in/terms" },
  "wallet": { "minTopup": { "amount": 10000, "currency": "INR" }, "maxTopup": { "amount": 1000000, "currency": "INR" } }
}
```

If `X-Client` reports an Android version below `minVersions.android`, all other endpoints return `426 APP_VERSION_UNSUPPORTED`; the app should show a "please update" screen linking to the Play Store.

## Health

- `GET /v1/health/live` → `200 {"status":"ok"}` while the process runs.
- `GET /v1/health/ready` → `200` when Postgres and Valkey respond within 500 ms, else `503`. Used by deploys and uptime checks.
