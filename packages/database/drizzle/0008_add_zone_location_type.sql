ALTER TABLE "zone_location" ADD COLUMN IF NOT EXISTS "type" text;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "zone_location_type_idx" ON "zone_location" USING btree ("type");
