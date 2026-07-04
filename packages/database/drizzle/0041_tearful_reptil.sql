ALTER TABLE "treasure_categories" ADD COLUMN "brand_id" text;--> statement-breakpoint
ALTER TABLE "treasure_categories" ADD CONSTRAINT "treasure_categories_brand_id_treasure_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."treasure_brands"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "treasure_categories_brand_id_idx" ON "treasure_categories" USING btree ("brand_id");--> statement-breakpoint
ALTER TABLE "treasure_brands" DROP COLUMN "core_categories";--> statement-breakpoint
ALTER TABLE "treasure_brands" DROP COLUMN "future_expansion";