ALTER TABLE "user" ADD COLUMN "metadata" jsonb;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_metadata_age_gender_check" CHECK (
  "metadata" IS NULL
  OR (
    (
      NOT ("metadata" ? 'age')
      OR "metadata"->'age' IS NULL
      OR jsonb_typeof("metadata"->'age') = 'number'
    )
    AND (
      NOT ("metadata" ? 'gender')
      OR "metadata"->>'gender' IN ('male', 'female', 'dont_disclose')
    )
  )
);
