import { relations } from "drizzle-orm";
import { products } from "../products/schema";
import { brands } from "./schema";

export const brandRelations = relations(brands, ({ many }) => ({
  products: many(products),
}));
