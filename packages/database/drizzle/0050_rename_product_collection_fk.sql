-- Rename truncated FK from 0049 to a stable short name (Postgres 63-char limit).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'treasure_products_collection_id_treasure_product_collections_id'
  ) THEN
    ALTER TABLE "treasure_products"
      RENAME CONSTRAINT "treasure_products_collection_id_treasure_product_collections_id"
      TO "treasure_products_collection_id_fk";
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'treasure_products_collection_id_treasure_product_collections_id_fk'
  ) THEN
    ALTER TABLE "treasure_products"
      RENAME CONSTRAINT "treasure_products_collection_id_treasure_product_collections_id_fk"
      TO "treasure_products_collection_id_fk";
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'treasure_products_collection_id_fk'
  ) AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'treasure_products' AND column_name = 'collection_id'
  ) THEN
    ALTER TABLE "treasure_products"
      ADD CONSTRAINT "treasure_products_collection_id_fk"
      FOREIGN KEY ("collection_id")
      REFERENCES "public"."treasure_product_collections"("id")
      ON DELETE set null
      ON UPDATE no action;
  END IF;
END $$;
