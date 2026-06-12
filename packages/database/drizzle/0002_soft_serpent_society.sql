ALTER TABLE "pods" DROP CONSTRAINT "pods_region_id_region_id_fk";
--> statement-breakpoint
ALTER TABLE "pods" DROP CONSTRAINT "pods_zone_id_zone_id_fk";
--> statement-breakpoint
DROP INDEX "pods_regionId_idx";--> statement-breakpoint
DROP INDEX "pods_zoneId_idx";--> statement-breakpoint
ALTER TABLE "pods" DROP COLUMN "region_id";--> statement-breakpoint
ALTER TABLE "pods" DROP COLUMN "zone_id";