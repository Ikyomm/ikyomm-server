import { type AnyPgColumn, index, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";
import { user } from "../../auth/schema";
import { referenceColumns } from "../../reference-columns";
import { brands } from "../brands/schema";
import { CategoryStatus } from "./enums";

export const categories = pgTable(
  "treasure_categories",
  {
    id: text("id").primaryKey(),
    brandId: text("brand_id").references(() => brands.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    status: CategoryStatus("status").default("ACTIVE").notNull(),
    ...referenceColumns((): AnyPgColumn => user.id),
  },
  (table) => [
    uniqueIndex("treasure_categories_slug_uidx").on(table.slug),
    index("treasure_categories_brand_id_idx").on(table.brandId),
    index("treasure_categories_status_idx").on(table.status),
  ]
);

export const subcategories = pgTable(
  "treasure_subcategories",
  {
    id: text("id").primaryKey(),
    categoryId: text("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    status: CategoryStatus("status").default("ACTIVE").notNull(),
    ...referenceColumns((): AnyPgColumn => user.id),
  },
  (table) => [
    uniqueIndex("treasure_subcategories_category_slug_uidx").on(table.categoryId, table.slug),
    uniqueIndex("treasure_subcategories_category_id_id_uidx").on(table.categoryId, table.id),
    index("treasure_subcategories_category_id_idx").on(table.categoryId),
    index("treasure_subcategories_status_idx").on(table.status),
  ]
);
