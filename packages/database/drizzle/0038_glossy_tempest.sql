DROP INDEX "treasure_brands_launch_phase_idx";--> statement-breakpoint
ALTER TABLE "treasure_brands" DROP COLUMN "launch_phase";--> statement-breakpoint
ALTER TABLE "treasure_products" DROP COLUMN "launch_phase";--> statement-breakpoint
DROP TYPE "public"."treasure_launch_phase";