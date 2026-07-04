import { type AnyPgColumn, index, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";
import { user } from "../../auth/schema";
import { referenceColumns } from "../../reference-columns";
import { BrandStatus } from "./enums";

export const brands = pgTable(
  "treasure_brands",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    logo: text("logo"),
    positioning: text("positioning"),
    tagline: text("tagline"),
    status: BrandStatus("status").default("ACTIVE").notNull(),
    ...referenceColumns((): AnyPgColumn => user.id),
  },
  (table) => [
    uniqueIndex("treasure_brands_name_uidx").on(table.name),
    uniqueIndex("treasure_brands_slug_uidx").on(table.slug),
    index("treasure_brands_status_idx").on(table.status),
  ]
);
