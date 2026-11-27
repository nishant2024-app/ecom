ALTER TABLE "addresses" ADD COLUMN "latitude" double precision;--> statement-breakpoint
ALTER TABLE "addresses" ADD COLUMN "longitude" double precision;--> statement-breakpoint
ALTER TABLE "addresses" ADD COLUMN "location_accuracy_m" integer;--> statement-breakpoint
ALTER TABLE "addresses" ADD COLUMN "location_source" text;--> statement-breakpoint
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_location_ck" CHECK (("addresses"."latitude" is null) = ("addresses"."longitude" is null) and ("addresses"."latitude" is null or ("addresses"."latitude" between 6 and 37.6 and "addresses"."longitude" between 68 and 97.5)));--> statement-breakpoint
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_location_source_ck" CHECK ("addresses"."location_source" is null or "addresses"."location_source" in ('device','map_pin'));