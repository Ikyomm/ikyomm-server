CREATE TABLE IF NOT EXISTS "treasure_product_collection_products" (
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
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'treasure_product_collection_products_product_id_treasure_products_id_fk'
	) THEN
		ALTER TABLE "treasure_product_collection_products"
			ADD CONSTRAINT "treasure_product_collection_products_product_id_treasure_products_id_fk"
			FOREIGN KEY ("product_id")
			REFERENCES "public"."treasure_products"("id")
			ON DELETE cascade ON UPDATE no action;
	END IF;

	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'treasure_product_collection_products_collection_id_treasure_product_collections_id_fk'
	) THEN
		ALTER TABLE "treasure_product_collection_products"
			ADD CONSTRAINT "treasure_product_collection_products_collection_id_treasure_product_collections_id_fk"
			FOREIGN KEY ("collection_id")
			REFERENCES "public"."treasure_product_collections"("id")
			ON DELETE cascade ON UPDATE no action;
	END IF;

	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'treasure_product_collection_products_created_by_user_user_id_fk'
	) THEN
		ALTER TABLE "treasure_product_collection_products"
			ADD CONSTRAINT "treasure_product_collection_products_created_by_user_user_id_fk"
			FOREIGN KEY ("created_by_user")
			REFERENCES "public"."user"("id")
			ON DELETE set null ON UPDATE no action;
	END IF;

	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'treasure_product_collection_products_updated_by_user_user_id_fk'
	) THEN
		ALTER TABLE "treasure_product_collection_products"
			ADD CONSTRAINT "treasure_product_collection_products_updated_by_user_user_id_fk"
			FOREIGN KEY ("updated_by_user")
			REFERENCES "public"."user"("id")
			ON DELETE set null ON UPDATE no action;
	END IF;

	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'treasure_product_collection_products_deleted_by_user_user_id_fk'
	) THEN
		ALTER TABLE "treasure_product_collection_products"
			ADD CONSTRAINT "treasure_product_collection_products_deleted_by_user_user_id_fk"
			FOREIGN KEY ("deleted_by_user")
			REFERENCES "public"."user"("id")
			ON DELETE set null ON UPDATE no action;
	END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "treasure_product_collection_products_product_id_idx"
	ON "treasure_product_collection_products" USING btree ("product_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "treasure_product_collection_products_collection_id_idx"
	ON "treasure_product_collection_products" USING btree ("collection_id");
--> statement-breakpoint
INSERT INTO "treasure_product_collection_products" (
	"product_id",
	"collection_id",
	"created_by_user",
	"updated_by_user"
)
SELECT
	"id",
	"collection_id",
	"created_by_user",
	"updated_by_user"
FROM "treasure_products"
WHERE "collection_id" IS NOT NULL
	AND EXISTS (
		SELECT 1
		FROM "treasure_product_collections" AS "collection"
		WHERE "collection"."id" = "treasure_products"."collection_id"
	)
ON CONFLICT ("product_id", "collection_id") DO NOTHING;
--> statement-breakpoint
ALTER TABLE "treasure_products" DROP CONSTRAINT IF EXISTS "treasure_products_collection_id_fk";
--> statement-breakpoint
ALTER TABLE "treasure_products"
	DROP CONSTRAINT IF EXISTS "treasure_products_collection_id_treasure_product_collections_id_fk";
--> statement-breakpoint
ALTER TABLE "treasure_products"
	DROP CONSTRAINT IF EXISTS "treasure_products_collection_id_treasure_product_collections_id";
--> statement-breakpoint
DROP INDEX IF EXISTS "treasure_products_collection_id_idx";
--> statement-breakpoint
ALTER TABLE "treasure_products" DROP COLUMN IF EXISTS "collection_id";
