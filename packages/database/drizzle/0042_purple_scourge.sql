WITH "ranked_inventory" AS (
	SELECT
		"id",
		SUM("quantity_available") OVER (PARTITION BY "variant_id")::integer AS "total_quantity_available",
		SUM("reserved_quantity") OVER (PARTITION BY "variant_id")::integer AS "total_reserved_quantity",
		MAX("low_stock_threshold") OVER (PARTITION BY "variant_id")::integer AS "maximum_low_stock_threshold",
		ROW_NUMBER() OVER (PARTITION BY "variant_id" ORDER BY "is_deleted" ASC, "created_at" ASC, "id" ASC) AS "row_number"
	FROM "treasure_inventory"
)
UPDATE "treasure_inventory" AS "inventory"
SET
	"quantity_available" = "ranked_inventory"."total_quantity_available",
	"reserved_quantity" = "ranked_inventory"."total_reserved_quantity",
	"low_stock_threshold" = "ranked_inventory"."maximum_low_stock_threshold"
FROM "ranked_inventory"
WHERE "inventory"."id" = "ranked_inventory"."id" AND "ranked_inventory"."row_number" = 1;--> statement-breakpoint
WITH "ranked_inventory" AS (
	SELECT
		"id",
		ROW_NUMBER() OVER (PARTITION BY "variant_id" ORDER BY "is_deleted" ASC, "created_at" ASC, "id" ASC) AS "row_number"
	FROM "treasure_inventory"
)
DELETE FROM "treasure_inventory" AS "inventory"
USING "ranked_inventory"
WHERE "inventory"."id" = "ranked_inventory"."id" AND "ranked_inventory"."row_number" > 1;--> statement-breakpoint
DELETE FROM "rbac_role_permission" WHERE "resource" = 'treasure_warehouses';--> statement-breakpoint
ALTER TABLE "treasure_inventory" DROP CONSTRAINT "treasure_inventory_warehouse_id_treasure_warehouses_id_fk";
--> statement-breakpoint
DROP INDEX "treasure_inventory_variant_warehouse_uidx";--> statement-breakpoint
DROP INDEX "treasure_inventory_warehouse_id_idx";--> statement-breakpoint
ALTER TABLE "treasure_inventory" DROP COLUMN "warehouse_id";--> statement-breakpoint
CREATE UNIQUE INDEX "treasure_inventory_variant_uidx" ON "treasure_inventory" USING btree ("variant_id");--> statement-breakpoint
ALTER TABLE "treasure_warehouses" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "treasure_warehouses";--> statement-breakpoint
DROP TYPE "public"."treasure_warehouse_status";
