-- Extensions required by the schema. PostGIS for delivery zones and address pins,
-- pg_trgm for typo-tolerant product search.
CREATE EXTENSION IF NOT EXISTS postgis;
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS pg_trgm;
