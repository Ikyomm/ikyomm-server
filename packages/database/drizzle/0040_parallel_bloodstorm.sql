ALTER TABLE "treasure_product_variants" DROP CONSTRAINT "treasure_product_variants_moq_check";--> statement-breakpoint
ALTER TABLE "treasure_product_variants" DROP COLUMN "vendor";--> statement-breakpoint
ALTER TABLE "treasure_product_variants" DROP COLUMN "minimum_order_quantity";--> statement-breakpoint
ALTER TABLE "treasure_products" DROP COLUMN "is_private_label";