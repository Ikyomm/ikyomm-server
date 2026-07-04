import { relations } from "drizzle-orm";
import { products } from "../products/schema";
import { categories, subcategories } from "./schema";

export const categoryRelations = relations(categories, ({ many }) => ({
  subcategories: many(subcategories),
}));

export const subcategoryRelations = relations(subcategories, ({ many, one }) => ({
  category: one(categories, {
    fields: [subcategories.categoryId],
    references: [categories.id],
  }),
  products: many(products),
}));
