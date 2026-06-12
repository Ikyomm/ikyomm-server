ALTER TABLE "user" ADD COLUMN "company" text;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_company_organization_id_fk" FOREIGN KEY ("company") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_company_idx" ON "user" USING btree ("company");