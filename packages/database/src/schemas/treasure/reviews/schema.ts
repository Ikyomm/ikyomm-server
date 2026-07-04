import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  check,
  index,
  integer,
  pgTable,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { user } from "../../auth/schema";
import { referenceColumns } from "../../reference-columns";
import { products } from "../products/schema";
import { ReviewStatus } from "./enums";

export const reviews = pgTable(
  "treasure_reviews",
  {
    id: text("id").primaryKey(),
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    rating: integer("rating").notNull(),
    title: text("title"),
    review: text("review"),
    status: ReviewStatus("status").default("PENDING").notNull(),
    ...referenceColumns((): AnyPgColumn => user.id),
  },
  (table) => [
    uniqueIndex("treasure_reviews_product_user_uidx").on(table.productId, table.userId),
    index("treasure_reviews_product_status_idx").on(table.productId, table.status),
    index("treasure_reviews_user_id_idx").on(table.userId),
    check("treasure_reviews_rating_check", sql`${table.rating} between 1 and 5`),
  ]
);
