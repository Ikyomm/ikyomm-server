import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { user } from "../../auth/schema";
import { referenceColumns } from "../../reference-columns";
import { brands } from "../brands/schema";
import { categories, subcategories } from "../categories/schema";
import { ProductStatus, ProductType, StockStatus, VariantStatus } from "./enums";

export type ProductMetadata = Record<string, string | number | boolean | null>;

export const products = pgTable(
  "treasure_products",
  {
    id: text("id").primaryKey(),
    brandId: text("brand_id")
      .notNull()
      .references(() => brands.id, { onDelete: "restrict" }),
    categoryId: text("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "restrict" }),
    subcategoryId: text("subcategory_id")
      .notNull()
      .references(() => subcategories.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    shortDescription: text("short_description"),
    description: text("description"),
    collection: text("collection"),
    materialOrIngredients: text("material_or_ingredients"),
    countryOfOrigin: text("country_of_origin"),
    targetCustomer: text("target_customer"),
    productType: ProductType("product_type").default("VARIABLE").notNull(),
    status: ProductStatus("status").default("DRAFT").notNull(),
    isHeroProduct: boolean("is_hero_product").default(false).notNull(),
    isPrivateLabel: boolean("is_private_label").default(false).notNull(),
    isSubscriptionEligible: boolean("is_subscription_eligible").default(false).notNull(),
    isBundleEligible: boolean("is_bundle_eligible").default(false).notNull(),
    isCorporateGiftEligible: boolean("is_corporate_gift_eligible").default(false).notNull(),
    isOmmpodsCompatible: boolean("is_ommpods_compatible").default(false).notNull(),
    metadata: jsonb("metadata").$type<ProductMetadata>(),
    ...referenceColumns((): AnyPgColumn => user.id),
  },
  (table) => [
    uniqueIndex("treasure_products_brand_slug_uidx").on(table.brandId, table.slug),
    index("treasure_products_brand_id_idx").on(table.brandId),
    index("treasure_products_category_id_idx").on(table.categoryId),
    index("treasure_products_subcategory_id_idx").on(table.subcategoryId),
    index("treasure_products_status_idx").on(table.status),
    index("treasure_products_product_type_idx").on(table.productType),
    foreignKey({
      columns: [table.categoryId, table.subcategoryId],
      foreignColumns: [subcategories.categoryId, subcategories.id],
      name: "treasure_products_category_subcategory_fk",
    }).onDelete("restrict"),
  ]
);

export const productVariants = pgTable(
  "treasure_product_variants",
  {
    id: text("id").primaryKey(),
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    sku: text("sku").notNull(),
    name: text("name").notNull(),
    size: text("size"),
    weightGrams: real("weight_grams"),
    estimatedCogs: real("estimated_cogs"),
    price: real("price").notNull(),
    currency: text("currency").default("INR").notNull(),
    grossMarginTarget: real("gross_margin_target"),
    vendor: text("vendor"),
    minimumOrderQuantity: integer("minimum_order_quantity"),
    packaging: text("packaging"),
    stockStatus: StockStatus("stock_status").default("OUT_OF_STOCK").notNull(),
    status: VariantStatus("status").default("PLANNED").notNull(),
    ...referenceColumns((): AnyPgColumn => user.id),
  },
  (table) => [
    uniqueIndex("treasure_product_variants_sku_uidx").on(table.sku),
    index("treasure_product_variants_product_id_idx").on(table.productId),
    index("treasure_product_variants_status_idx").on(table.status),
    index("treasure_product_variants_stock_status_idx").on(table.stockStatus),
    check("treasure_product_variants_price_check", sql`${table.price} >= 0`),
    check(
      "treasure_product_variants_estimated_cogs_check",
      sql`${table.estimatedCogs} is null or ${table.estimatedCogs} >= 0`
    ),
    check(
      "treasure_product_variants_margin_check",
      sql`${table.grossMarginTarget} is null or (${table.grossMarginTarget} >= 0 and ${table.grossMarginTarget} <= 100)`
    ),
    check(
      "treasure_product_variants_moq_check",
      sql`${table.minimumOrderQuantity} is null or ${table.minimumOrderQuantity} > 0`
    ),
  ]
);

export const productImages = pgTable(
  "treasure_product_images",
  {
    id: text("id").primaryKey(),
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    altText: text("alt_text"),
    isPrimary: boolean("is_primary").default(false).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    ...referenceColumns((): AnyPgColumn => user.id),
  },
  (table) => [
    uniqueIndex("treasure_product_images_product_url_uidx").on(table.productId, table.url),
    index("treasure_product_images_product_sort_idx").on(table.productId, table.sortOrder),
    check("treasure_product_images_sort_order_check", sql`${table.sortOrder} >= 0`),
  ]
);

export const variantAttributes = pgTable(
  "treasure_variant_attributes",
  {
    id: text("id").primaryKey(),
    variantId: text("variant_id")
      .notNull()
      .references(() => productVariants.id, { onDelete: "cascade" }),
    attributeName: text("attribute_name").notNull(),
    attributeValue: text("attribute_value").notNull(),
    ...referenceColumns((): AnyPgColumn => user.id),
  },
  (table) => [
    uniqueIndex("treasure_variant_attributes_name_uidx").on(table.variantId, table.attributeName),
    index("treasure_variant_attributes_variant_id_idx").on(table.variantId),
  ]
);
