CREATE TYPE "public"."aroma_defuser_container_type" AS ENUM('SETTLE', 'RISE', 'RESTORE', 'DEPTHS');--> statement-breakpoint
ALTER TABLE "pod_mood_presets" ADD COLUMN "aroma_defuser_container_type" "aroma_defuser_container_type" DEFAULT 'SETTLE' NOT NULL;--> statement-breakpoint
CREATE INDEX "pod_mood_presets_aromaDefuserContainerType_idx" ON "pod_mood_presets" USING btree ("aroma_defuser_container_type");--> statement-breakpoint
UPDATE "aroma_defuser"
SET "containers" = (
  SELECT COALESCE(jsonb_agg(
    CASE
      WHEN jsonb_typeof(container) = 'object' AND NOT (container ? 'type')
        THEN container || '{"type":"SETTLE"}'::jsonb
      ELSE container
    END
    ORDER BY ordinality
  ), '[]'::jsonb)
  FROM jsonb_array_elements("aroma_defuser"."containers") WITH ORDINALITY AS items(container, ordinality)
)
WHERE jsonb_typeof("containers") = 'array';--> statement-breakpoint
