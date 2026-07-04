import { relations } from "drizzle-orm";
import { user } from "../../auth/schema";
import { products } from "../products/schema";
import { reviews } from "./schema";

export const reviewRelations = relations(reviews, ({ one }) => ({
  product: one(products, {
    fields: [reviews.productId],
    references: [products.id],
  }),
  user: one(user, {
    fields: [reviews.userId],
    references: [user.id],
  }),
}));
