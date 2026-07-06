ALTER TABLE "treasure_product_variants" DROP CONSTRAINT "treasure_product_variants_estimated_cogs_check";--> statement-breakpoint
ALTER TABLE "treasure_product_variants" DROP COLUMN "estimated_cogs";--> statement-breakpoint
ALTER TABLE "treasure_products" DROP COLUMN "target_customer";