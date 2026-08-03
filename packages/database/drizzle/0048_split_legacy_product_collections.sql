WITH legacy_collection_values AS (
	SELECT DISTINCT
		lower(trim("value")) AS legacy_key,
		min(trim("value")) AS name
	FROM "treasure_products"
	CROSS JOIN LATERAL regexp_split_to_table(coalesce("collection", ''), ',') AS "value"
	WHERE trim("value") <> ''
	GROUP BY lower(trim("value"))
)
INSERT INTO "treasure_product_collections" ("id", "name", "slug")
SELECT
	'pc_' || substr(md5("legacy_key"), 1, 24),
	"name",
	CASE
		WHEN trim(both '-' FROM regexp_replace("legacy_key", '[^a-z0-9]+', '-', 'g')) = '' THEN 'collection-' || substr(md5("legacy_key"), 1, 8)
		ELSE trim(both '-' FROM regexp_replace("legacy_key", '[^a-z0-9]+', '-', 'g')) || '-' || substr(md5("legacy_key"), 1, 8)
	END
FROM "legacy_collection_values"
ON CONFLICT DO NOTHING;--> statement-breakpoint
WITH legacy_product_collections AS (
	SELECT
		"product"."id" AS product_id,
		'pc_' || substr(md5(lower(trim("value"))), 1, 24) AS collection_id,
		"product"."created_by_user" AS created_by_user
	FROM "treasure_products" AS "product"
	CROSS JOIN LATERAL regexp_split_to_table(coalesce("product"."collection", ''), ',') AS "value"
	WHERE trim("value") <> ''
)
INSERT INTO "treasure_product_collection_products" ("product_id", "collection_id", "created_by_user")
SELECT "product_id", "collection_id", "created_by_user"
FROM "legacy_product_collections"
ON CONFLICT DO NOTHING;--> statement-breakpoint
DELETE FROM "treasure_product_collection_products" AS "link"
USING "treasure_product_collections" AS "collection"
WHERE "link"."collection_id" = "collection"."id"
	AND "collection"."name" LIKE '%,%';--> statement-breakpoint
DELETE FROM "treasure_product_collections"
WHERE "name" LIKE '%,%';
