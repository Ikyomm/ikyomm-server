import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  check,
  foreignKey,
  index,
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
export type ProductImage = {
  url: string;
  altText?: string | null;
  isPrimary?: boolean;
  sortOrder?: number;
};
export type ProductVariantAttributes = Record<string, string>;

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
    productType: ProductType("product_type").default("VARIABLE").notNull(),
    status: ProductStatus("status").default("DRAFT").notNull(),
    isHeroProduct: boolean("is_hero_product").default(false).notNull(),
    isSubscriptionEligible: boolean("is_subscription_eligible").default(false).notNull(),
    isBundleEligible: boolean("is_bundle_eligible").default(false).notNull(),
    isCorporateGiftEligible: boolean("is_corporate_gift_eligible").default(false).notNull(),
    isOmmpodsCompatible: boolean("is_ommpods_compatible").default(false).notNull(),
    images: jsonb("images").$type<ProductImage[]>().default([]).notNull(),
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
    price: real("price").notNull(),
    currency: text("currency").default("INR").notNull(),
    packaging: text("packaging"),
    attributes: jsonb("attributes").$type<ProductVariantAttributes>().default({}).notNull(),
    stockStatus: StockStatus("stock_status").default("OUT_OF_STOCK").notNull(),
    status: VariantStatus("status").default("PLANNED").notNull(),
    ...referenceColumns((): AnyPgColumn => user.id),
  },
  (table) => [
    uniqueIndex("treasure_product_variants_sku_uidx").on(sql`upper(${table.sku})`),
    index("treasure_product_variants_product_id_idx").on(table.productId),
    index("treasure_product_variants_status_idx").on(table.status),
    index("treasure_product_variants_stock_status_idx").on(table.stockStatus),
    check("treasure_product_variants_price_check", sql`${table.price} >= 0`),
  ]
);
