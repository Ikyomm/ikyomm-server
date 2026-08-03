import { relations } from "drizzle-orm";
import { brands } from "../brands/schema";
import { categories, subcategories } from "../categories/schema";
import { inventory } from "../inventory/schema";
import { orderItems } from "../orders/schema";
import { reviews } from "../reviews/schema";
import { subscriptions } from "../subscriptions/schema";
import { productCollectionProducts, productCollections, products, productVariants } from "./schema";

export const productCollectionRelations = relations(productCollections, ({ many }) => ({
  productLinks: many(productCollectionProducts),
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
  variants: many(productVariants),
  collectionLinks: many(productCollectionProducts),
  reviews: many(reviews),
}));

export const productCollectionProductRelations = relations(
  productCollectionProducts,
  ({ one }) => ({
    product: one(products, {
      fields: [productCollectionProducts.productId],
      references: [products.id],
    }),
    collection: one(productCollections, {
      fields: [productCollectionProducts.collectionId],
      references: [productCollections.id],
    }),
  })
);

export const productVariantRelations = relations(productVariants, ({ many, one }) => ({
  product: one(products, {
    fields: [productVariants.productId],
    references: [products.id],
  }),
  inventory: many(inventory),
  orderItems: many(orderItems),
  subscriptions: many(subscriptions),
}));
