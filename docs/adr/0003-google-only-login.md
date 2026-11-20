# ADR 0003: Google Sign-In only; no SMS OTP

- **Status:** Accepted
- **Date:** 2026-11-20

## Context

Indian commerce apps usually use phone OTP. SMS costs money per message and needs DLT registration, which conflicts with the zero-cost requirement. The owner decided: no SMS login, Google login only. The Android app will come later.

## Decision

Customers, staff and delivery agents all sign in with **Google**. Clients obtain a Google ID token (Google Identity Services on web, Credential Manager on Android, both using the web client ID as audience) and exchange it at `POST /v1/auth/google` for our own tokens. Nonces prevent replay. Accounts are keyed by Google `sub`, not email. Staff and agents must be invited, are bound to one Google account, and money/settings roles also need TOTP.

## Alternatives considered

- **Phone OTP via SMS:** costs per message; DLT setup.
- **Email magic links:** free, but slower and limited by free email quotas (~400/day).
- **Passwords:** support burden, security risk.
- **Firebase Auth:** adds a dependency; we still need our own sessions and roles.

## Consequences

- ₹0 login cost at any scale; one-tap sign-in on Android.
- Phone numbers are collected but **unverified**. Acceptable because all orders are prepaid; agents call the number for delivery.
- Customers without a Google account can't sign up. Very few Android users in India lack one; revisit if support requests show otherwise.
