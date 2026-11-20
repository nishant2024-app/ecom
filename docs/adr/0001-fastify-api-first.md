# ADR 0001: One Fastify REST API for web, admin and Android

- **Status:** Accepted
- **Date:** 2026-11-20

## Context

The storefront, admin panel, delivery agent app and a future Android app all need the same data and rules. The owner asked for Fastify for APIs and for APIs that the Android app can use later.

## Decision

Build a single versioned REST API (`/v1`) with **Fastify 5** and TypeScript. Route groups per audience (`store`, `agent`, `admin`, `webhooks`). TypeBox schemas on every route generate the OpenAPI 3.1 spec. Business rules live in `packages/core`, not in routes. No client talks to the database directly; the storefront's Next.js server calls the API too.

## Alternatives considered

- **Next.js route handlers / server actions as the backend:** fast to start, but ties the backend to the web framework and isn't a clean public API for Android.
- **Express:** slower, no built-in schema validation/serialisation.
- **NestJS:** more structure but heavier; Fastify with plugins gives what we need.
- **GraphQL:** flexible, but harder to cache at the CDN and more complex for a small team; REST + OpenAPI generates good clients.

## Consequences

- One place to secure, rate-limit and monitor.
- Android work later needs no backend changes.
- We must keep `/v1` backward compatible; CI enforces this with an OpenAPI diff.
