ALTER TABLE "treasure_products" ADD COLUMN "collection_id" text;--> statement-breakpoint
UPDATE "treasure_products" AS "product"
SET "collection_id" = "link"."collection_id"
FROM (
	SELECT DISTINCT ON ("product_id")
		"product_id",
		"collection_id"
	FROM "treasure_product_collection_products"
	ORDER BY "product_id", "collection_id"
) AS "link"
WHERE "product"."id" = "link"."product_id";--> statement-breakpoint
ALTER TABLE "treasure_products" ADD CONSTRAINT "treasure_products_collection_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."treasure_product_collections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "treasure_products_collection_id_idx" ON "treasure_products" USING btree ("collection_id");--> statement-breakpoint
DROP TABLE IF EXISTS "treasure_product_collection_products";--> statement-breakpoint
ALTER TABLE "treasure_products" DROP COLUMN IF EXISTS "collection";
