ALTER TABLE "aroma_defuser" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "door_lock" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "touchpad" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "aroma_defuser" CASCADE;--> statement-breakpoint
DROP TABLE "door_lock" CASCADE;--> statement-breakpoint
DROP TABLE "touchpad" CASCADE;--> statement-breakpoint
ALTER TABLE "pods" RENAME COLUMN "metadata" TO "connected_device_config";--> statement-breakpoint
ALTER TABLE "pods" DROP CONSTRAINT "pods_door_lock_id_door_lock_id_fk";
--> statement-breakpoint
ALTER TABLE "pods" DROP CONSTRAINT "pods_aroma_defuser_id_aroma_defuser_id_fk";
--> statement-breakpoint
ALTER TABLE "pods" DROP CONSTRAINT "pods_touchpad_id_touchpad_id_fk";
--> statement-breakpoint
DROP INDEX "pods_door_lock_id_uidx";--> statement-breakpoint
DROP INDEX "pods_aroma_defuser_id_uidx";--> statement-breakpoint
DROP INDEX "pods_touchpad_id_uidx";--> statement-breakpoint
DROP INDEX IF EXISTS "pods_mac_id_uidx";--> statement-breakpoint
DROP INDEX IF EXISTS "pods_mac_id_idx";--> statement-breakpoint
ALTER TABLE "pods" DROP COLUMN "door_lock_id";--> statement-breakpoint
ALTER TABLE "pods" DROP COLUMN "aroma_defuser_id";--> statement-breakpoint
ALTER TABLE "pods" DROP COLUMN "touchpad_id";--> statement-breakpoint
ALTER TABLE "pods" DROP COLUMN IF EXISTS "mac_id";--> statement-breakpoint
DROP TYPE "public"."door_lock_device_status";
