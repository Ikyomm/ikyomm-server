DROP INDEX "treasure_product_variants_sku_uidx";--> statement-breakpoint
CREATE UNIQUE INDEX "treasure_product_variants_sku_uidx" ON "treasure_product_variants" USING btree (upper("sku"));