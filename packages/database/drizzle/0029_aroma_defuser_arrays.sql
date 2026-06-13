ALTER TABLE "pods" ADD COLUMN "aroma_defuser_ids" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
UPDATE "pods"
SET "aroma_defuser_ids" = CASE
  WHEN "aroma_defuser_id" IS NULL THEN '[]'::jsonb
  ELSE jsonb_build_array("aroma_defuser_id")
END;--> statement-breakpoint
ALTER TABLE "pods" DROP CONSTRAINT IF EXISTS "pods_aroma_defuser_id_aroma_defuser_id_fk";--> statement-breakpoint
DROP INDEX IF EXISTS "pods_aromaDefuserId_idx";--> statement-breakpoint
ALTER TABLE "pods" DROP COLUMN IF EXISTS "aroma_defuser_id";--> statement-breakpoint
CREATE INDEX "pods_aromaDefuserIds_idx" ON "pods" USING gin ("aroma_defuser_ids");--> statement-breakpoint
ALTER TABLE "pod_mood_presets" ADD COLUMN "aroma_defuser_containers" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
CREATE INDEX "pod_mood_presets_aromaDefuserContainers_idx" ON "pod_mood_presets" USING gin ("aroma_defuser_containers");
