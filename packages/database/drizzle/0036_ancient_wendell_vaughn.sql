CREATE TYPE "public"."aroma_defuser_container_type" AS ENUM('SETTLE', 'RISE', 'RESTORE', 'DEPTHS');--> statement-breakpoint
ALTER TABLE "pod_mood_presets" RENAME COLUMN "aroma_defuser_containers" TO "aroma_defuser_container_type";--> statement-breakpoint
DROP INDEX "pod_mood_presets_aromaDefuserContainers_idx";--> statement-breakpoint
CREATE INDEX "pod_mood_presets_aromaDefuserContainerType_idx" ON "pod_mood_presets" USING btree ("aroma_defuser_container_type");