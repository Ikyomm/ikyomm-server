ALTER TABLE "aroma_defuser" ADD COLUMN "name" text;--> statement-breakpoint
CREATE INDEX "aroma_defuser_name_idx" ON "aroma_defuser" USING btree ("name");
