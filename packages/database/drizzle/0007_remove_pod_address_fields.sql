DROP INDEX IF EXISTS "pods_country_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "pods_state_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "pods_city_idx";--> statement-breakpoint
ALTER TABLE "pods" DROP COLUMN IF EXISTS "country";--> statement-breakpoint
ALTER TABLE "pods" DROP COLUMN IF EXISTS "state";--> statement-breakpoint
ALTER TABLE "pods" DROP COLUMN IF EXISTS "city";--> statement-breakpoint
ALTER TABLE "pods" DROP COLUMN IF EXISTS "address";
