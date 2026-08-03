CREATE TABLE "treasure_product_collection_products" (
	"product_id" text NOT NULL,
	"collection_id" text NOT NULL,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by_user" text,
	"updated_by_user" text,
	"deleted_by_user" text,
	"is_deleted" boolean DEFAULT false NOT NULL,
	CONSTRAINT "treasure_product_collection_products_pk" PRIMARY KEY("product_id","collection_id")
);
--> statement-breakpoint
CREATE TABLE "treasure_product_collections" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"status" "treasure_category_status" DEFAULT 'ACTIVE' NOT NULL,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by_user" text,
	"updated_by_user" text,
	"deleted_by_user" text,
	"is_deleted" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "treasure_product_collection_products" ADD CONSTRAINT "treasure_product_collection_products_product_id_treasure_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."treasure_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasure_product_collection_products" ADD CONSTRAINT "treasure_product_collection_products_collection_id_treasure_product_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."treasure_product_collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasure_product_collection_products" ADD CONSTRAINT "treasure_product_collection_products_created_by_user_user_id_fk" FOREIGN KEY ("created_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasure_product_collection_products" ADD CONSTRAINT "treasure_product_collection_products_updated_by_user_user_id_fk" FOREIGN KEY ("updated_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasure_product_collection_products" ADD CONSTRAINT "treasure_product_collection_products_deleted_by_user_user_id_fk" FOREIGN KEY ("deleted_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasure_product_collections" ADD CONSTRAINT "treasure_product_collections_created_by_user_user_id_fk" FOREIGN KEY ("created_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasure_product_collections" ADD CONSTRAINT "treasure_product_collections_updated_by_user_user_id_fk" FOREIGN KEY ("updated_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasure_product_collections" ADD CONSTRAINT "treasure_product_collections_deleted_by_user_user_id_fk" FOREIGN KEY ("deleted_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "treasure_product_collection_products_product_id_idx" ON "treasure_product_collection_products" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "treasure_product_collection_products_collection_id_idx" ON "treasure_product_collection_products" USING btree ("collection_id");--> statement-breakpoint
CREATE UNIQUE INDEX "treasure_product_collections_name_uidx" ON "treasure_product_collections" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "treasure_product_collections_slug_uidx" ON "treasure_product_collections" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "treasure_product_collections_status_idx" ON "treasure_product_collections" USING btree ("status");--> statement-breakpoint
WITH legacy_collections AS (
	SELECT
		lower(trim("collection")) AS legacy_key,
		min(trim("collection")) AS name
	FROM "treasure_products"
	WHERE "collection" IS NOT NULL AND trim("collection") <> ''
	GROUP BY lower(trim("collection"))
)
INSERT INTO "treasure_product_collections" ("id", "name", "slug")
SELECT
	'pc_' || substr(md5("legacy_key"), 1, 24),
	"name",
	CASE
		WHEN trim(both '-' FROM regexp_replace("legacy_key", '[^a-z0-9]+', '-', 'g')) = '' THEN 'collection-' || substr(md5("legacy_key"), 1, 8)
		ELSE trim(both '-' FROM regexp_replace("legacy_key", '[^a-z0-9]+', '-', 'g')) || '-' || substr(md5("legacy_key"), 1, 8)
	END
FROM "legacy_collections"
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO "treasure_product_collection_products" ("product_id", "collection_id", "created_by_user")
SELECT
	"product"."id",
	'pc_' || substr(md5(lower(trim("product"."collection"))), 1, 24),
	"product"."created_by_user"
FROM "treasure_products" AS "product"
WHERE "product"."collection" IS NOT NULL AND trim("product"."collection") <> ''
ON CONFLICT DO NOTHING;
