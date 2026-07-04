import { relations } from "drizzle-orm";
import { brands } from "../brands/schema";
import { categories, subcategories } from "../categories/schema";
import { inventory } from "../inventory/schema";
import { orderItems } from "../orders/schema";
import { reviews } from "../reviews/schema";
import { subscriptions } from "../subscriptions/schema";
import { productImages, products, productVariants, variantAttributes } from "./schema";

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
  images: many(productImages),
  reviews: many(reviews),
}));

export const productVariantRelations = relations(productVariants, ({ many, one }) => ({
  product: one(products, {
    fields: [productVariants.productId],
    references: [products.id],
  }),
  attributes: many(variantAttributes),
  inventory: many(inventory),
  orderItems: many(orderItems),
  subscriptions: many(subscriptions),
}));

export const productImageRelations = relations(productImages, ({ one }) => ({
  product: one(products, {
    fields: [productImages.productId],
    references: [products.id],
  }),
}));

export const variantAttributeRelations = relations(variantAttributes, ({ one }) => ({
  variant: one(productVariants, {
    fields: [variantAttributes.variantId],
    references: [productVariants.id],
  }),
}));
