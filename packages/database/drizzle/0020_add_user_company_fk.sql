CREATE INDEX IF NOT EXISTS "user_company_idx" ON "user" USING btree ("company");
UPDATE "user"
SET "company" = NULL
WHERE "company" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "organization"
    WHERE "organization"."id" = "user"."company"
  );
ALTER TABLE "user" ADD CONSTRAINT "user_company_organization_id_fk" FOREIGN KEY ("company") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action;
