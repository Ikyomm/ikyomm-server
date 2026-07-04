import { pgEnum } from "drizzle-orm/pg-core";

export const ProductStatus = pgEnum("treasure_product_status", [
  "PLANNED",
  "DRAFT",
  "ACTIVE",
  "INACTIVE",
  "OUT_OF_STOCK",
]);

export const ProductType = pgEnum("treasure_product_type", [
  "SIMPLE",
  "VARIABLE",
  "BUNDLE",
  "SUBSCRIPTION",
]);

export const VariantStatus = pgEnum("treasure_variant_status", ["PLANNED", "ACTIVE", "INACTIVE"]);

export const StockStatus = pgEnum("treasure_stock_status", [
  "IN_STOCK",
  "LOW_STOCK",
  "OUT_OF_STOCK",
]);

export type ProductStatus = (typeof ProductStatus.enumValues)[number];
export type ProductType = (typeof ProductType.enumValues)[number];
export type VariantStatus = (typeof VariantStatus.enumValues)[number];
export type StockStatus = (typeof StockStatus.enumValues)[number];
