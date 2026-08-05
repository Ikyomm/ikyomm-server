import { relations } from "drizzle-orm";
import { brands } from "../brands/schema";
import { categories, subcategories } from "../categories/schema";
import { inventory } from "../inventory/schema";
import { orderItems } from "../orders/schema";
import { reviews } from "../reviews/schema";
import { subscriptions } from "../subscriptions/schema";
import { productCollections, products, productVariants } from "./schema";

export const productCollectionRelations = relations(productCollections, ({ many }) => ({
  products: many(products),
}));

export const productRelations = relations(products, ({ many, one }) => ({
  brand: one(brands, {
    fields: [products.brandId],
    references: [brands.id],
  }),
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  subcategory: one(subcategories, {
    fields: [products.subcategoryId],
    references: [subcategories.id],
  }),
  collection: one(productCollections, {
    fields: [products.collectionId],
    references: [productCollections.id],
  }),
  variants: many(productVariants),
  reviews: many(reviews),
}));

export const productVariantRelations = relations(productVariants, ({ many, one }) => ({
  product: one(products, {
    fields: [productVariants.productId],
    references: [products.id],
  }),
  inventory: many(inventory),
  orderItems: many(orderItems),
  subscriptions: many(subscriptions),
}));
