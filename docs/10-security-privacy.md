# 10 · Security and privacy

## Threat model

| Asset | Threat | Controls |
|---|---|---|
| Customer wallet money | Double charges, replayed requests, forged payment success | Idempotency keys; ledger unique constraints; payments only marked paid by verified webhook or server-side status check; daily reconciliation |
| Admin panel | Account takeover, unauthorised access | Cloudflare Access allowlist + Google sign-in + staff binding to Google `sub` + TOTP for money/settings roles; short staff sessions (12 h); audit log |
| Customer accounts | Session theft | httpOnly Secure cookies, CSRF tokens, refresh token rotation with reuse detection, per-device session list and revoke |
| Customer personal data | Leak via API or logs | Authorisation on every query (customers only see their own rows); agents see only stops on their run with shortened names; PII redacted from logs; least-privilege DB users |
| Payment webhooks | Forged events | HMAC signature on raw body, timestamp freshness, event dedupe |
| Server | Intrusion | No open inbound ports (Cloudflare Tunnel); SSH only via Tunnel with keys; unattended security updates; fail2ban; containers run as non-root; read-only root filesystems where possible |
| Database | Data loss, ransomware | Private network only; continuous WAL archiving + nightly backups to two providers (R2, OCI) with different credentials; monthly restore test; backups encrypted |
| API availability | Abuse, scraping, DDoS | Cloudflare WAF and DDoS protection; rate limits per IP and user; `under-pressure` load shedding |
| Uploads | Malicious files | Signed upload URLs with content type and size limits; images re-encoded by `sharp` (strips metadata and payloads); no SVG uploads |
| Supply chain | Compromised dependency | Lockfile; `pnpm audit` and Dependabot; pinned Docker base images by digest; GitHub Actions pinned by SHA |
| Secrets | Leak in git | SOPS + age encrypted env files; gitleaks in CI; secrets only on servers that need them; production keys never on laptops |

## Application controls

- **Input:** every route has a TypeBox schema; unknown properties are rejected (`additionalProperties: false`) on writes.
- **Output:** response schemas strip any field not declared, so internal columns can't leak by accident.
- **SQL:** Drizzle query builder with parameters; raw SQL only in reviewed `packages/db/sql/` files.
- **Authorisation:** checked in a route hook from the declared permission, plus ownership checks in queries (`WHERE customer_id = $currentUser`). Row-level security on seller-scoped tables as a second layer.
- **Headers:** `@fastify/helmet`: HSTS (preload), `X-Content-Type-Options`, `Referrer-Policy: strict-origin-when-cross-origin`, frame-ancestors none. Storefront CSP with nonces; only Cashfree and Google Identity script origins allowed.
- **CORS:** exact origin allowlist (`example.in`, `admin.example.in`, `agent.example.in`, staging equivalents, localhost in dev) with credentials.
- **Rate limits:** see [API guide](api/README.md#rate-limits).
- **Errors:** no stack traces or SQL in responses; `requestId` links to server logs.
- **Money:** integer paise only; one conversion helper for Cashfree's rupee decimals, with tests.

## Staff security

- Invite-only; bound to one Google account; deactivation revokes sessions instantly.
- TOTP required for Owner, Admin and Accountant roles.
- Wallet adjustment limits per role; larger adjustments need Owner/Admin.
- All staff actions in `audit_log` with before/after values; audit log is append-only and exportable.
- Quarterly access review: remove staff who left, check roles.

## Privacy (India DPDP Act basics)

| Principle | How we comply |
|---|---|
| Notice | Privacy policy at `example.in/privacy` in English and Hindi, linked at sign-in |
| Consent | Sign-in creates an account for the service. Marketing notifications are opt-in and can be withdrawn any time. |
| Purpose limitation | Data used only to deliver orders, take payments, support and (opt-in) marketing |
| Data minimisation | Name, email (from Google), phone, address, location pin. No date of birth, no ID documents, no contacts access. |
| Access and correction | Customers see and edit their data in the account page |
| Erasure | Account deletion flow ([Authentication](04-authentication.md#account-deletion)); tax records retained as legally required with anonymised references |
| Security | This document |
| Breach notification | Incident runbook includes notifying affected users and the Data Protection Board as required |
| Grievance | Named grievance contact and email on the privacy page |

## Data retention

| Data | Kept for |
|---|---|
| Invoices, ledger, payments, settlements | As required by GST and income tax law (plan for at least 8 years), then deleted |
| Delivery records | 3 years, then aggregated |
| Proof-of-delivery photos | 90 days |
| Sessions | Until expiry + 30 days |
| Application logs | 30 days (PII redacted) |
| Audit log | 8 years |
| Webhook payloads | 1 year |
| Deleted accounts' personal data | Erased 30 days after the deletion request |

Confirm retention periods with the business's chartered accountant and update this table.

## Security testing

- Automated: dependency audit, gitleaks, OpenAPI-driven negative tests (auth required, wrong owner, wrong role), CSRF tests.
- Webhook tests: tampered body, wrong secret, stale timestamp, duplicate event.
- Before launch: manual review against the OWASP API Security Top 10 and ASVS level 1; an external review if budget allows.
- Responsible disclosure: `security@example.in` and `/.well-known/security.txt` on the storefront.
