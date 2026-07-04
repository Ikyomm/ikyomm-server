import { relations } from "drizzle-orm";
import { categories } from "../categories/schema";
import { products } from "../products/schema";
import { brands } from "./schema";

export const brandRelations = relations(brands, ({ many }) => ({
  categories: many(categories),
  products: many(products),
}));
