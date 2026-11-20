# ADR 0005: PostgreSQL self-hosted instead of Supabase

- **Status:** Accepted
- **Date:** 2026-11-20

## Context

We need a relational database with transactions (orders, payments, stock), row locks for stock reservation, and full-text search. Supabase's free tier pauses after 7 days without activity and has small storage limits; paid plans cost money monthly.

## Decision

Run **PostgreSQL 17 with pg_trgm** in Docker on the data VM. Drizzle ORM and SQL migrations in the repo. pgBackRest for continuous WAL archiving and nightly backups to two providers. Separate database roles for app, migrator, read-only and backup.

## Consequences

- No pausing, no row or storage caps beyond our disk (up to ~150 GB available).
- We own tuning, upgrades and backups; restore is tested monthly.
- Plain Postgres, so moving to a managed service later (Neon, RDS, Cloud SQL, Supabase paid) is a dump-and-restore.
