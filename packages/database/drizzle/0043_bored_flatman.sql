CREATE TYPE "public"."treasure_warehouse_status" AS ENUM('ACTIVE', 'INACTIVE');--> statement-breakpoint
CREATE TABLE "treasure_warehouses" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"address_line_1" text NOT NULL,
	"address_line_2" text,
	"city" text NOT NULL,
	"state" text NOT NULL,
	"country" text DEFAULT 'IN' NOT NULL,
	"pincode" text NOT NULL,
	"status" "treasure_warehouse_status" DEFAULT 'ACTIVE' NOT NULL,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by_user" text,
	"updated_by_user" text,
	"deleted_by_user" text,
	"is_deleted" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
DROP INDEX "treasure_inventory_variant_uidx";--> statement-breakpoint
INSERT INTO "treasure_warehouses" (
	"id", "name", "address_line_1", "city", "state", "country", "pincode"
) VALUES (
	'treasure_primary_warehouse', 'Primary Warehouse', 'To be configured',
	'To be configured', 'To be configured', 'IN', '000000'
);--> statement-breakpoint
ALTER TABLE "treasure_inventory" ADD COLUMN "warehouse_id" text;--> statement-breakpoint
UPDATE "treasure_inventory"
SET "warehouse_id" = 'treasure_primary_warehouse'
WHERE "warehouse_id" IS NULL;--> statement-breakpoint
ALTER TABLE "treasure_inventory" ALTER COLUMN "warehouse_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "treasure_warehouses" ADD CONSTRAINT "treasure_warehouses_created_by_user_user_id_fk" FOREIGN KEY ("created_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasure_warehouses" ADD CONSTRAINT "treasure_warehouses_updated_by_user_user_id_fk" FOREIGN KEY ("updated_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasure_warehouses" ADD CONSTRAINT "treasure_warehouses_deleted_by_user_user_id_fk" FOREIGN KEY ("deleted_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "treasure_warehouses_name_uidx" ON "treasure_warehouses" USING btree ("name");--> statement-breakpoint
CREATE INDEX "treasure_warehouses_status_idx" ON "treasure_warehouses" USING btree ("status");--> statement-breakpoint
ALTER TABLE "treasure_inventory" ADD CONSTRAINT "treasure_inventory_warehouse_id_treasure_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."treasure_warehouses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "treasure_inventory_variant_warehouse_uidx" ON "treasure_inventory" USING btree ("variant_id","warehouse_id");--> statement-breakpoint
CREATE INDEX "treasure_inventory_warehouse_id_idx" ON "treasure_inventory" USING btree ("warehouse_id");
