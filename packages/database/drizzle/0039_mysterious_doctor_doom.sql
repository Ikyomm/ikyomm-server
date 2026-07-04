ALTER TABLE "treasure_product_variants" ADD COLUMN "attributes" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "treasure_products" ADD COLUMN "images" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
UPDATE "treasure_products" AS "product"
SET "images" = COALESCE(
	(
		SELECT jsonb_agg(
			jsonb_build_object(
				'url', "image"."url",
				'altText', "image"."alt_text",
				'isPrimary', "image"."is_primary",
				'sortOrder', "image"."sort_order"
			)
			ORDER BY "image"."sort_order", "image"."id"
		)
		FROM "treasure_product_images" AS "image"
		WHERE "image"."product_id" = "product"."id"
			AND "image"."is_deleted" = false
	),
	'[]'::jsonb
);--> statement-breakpoint
UPDATE "treasure_product_variants" AS "variant"
SET "attributes" = COALESCE(
	(
		SELECT jsonb_object_agg("attribute"."attribute_name", "attribute"."attribute_value")
		FROM "treasure_variant_attributes" AS "attribute"
		WHERE "attribute"."variant_id" = "variant"."id"
			AND "attribute"."is_deleted" = false
	),
	'{}'::jsonb
);--> statement-breakpoint
ALTER TABLE "treasure_product_images" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "treasure_variant_attributes" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "treasure_product_images" CASCADE;--> statement-breakpoint
DROP TABLE "treasure_variant_attributes" CASCADE;--> statement-breakpoint
ALTER TABLE "treasure_product_variants" DROP CONSTRAINT "treasure_product_variants_margin_check";--> statement-breakpoint
ALTER TABLE "treasure_product_variants" DROP COLUMN "gross_margin_target";
