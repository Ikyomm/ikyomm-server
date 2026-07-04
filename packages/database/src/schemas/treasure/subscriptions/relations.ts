import { relations } from "drizzle-orm";
import { user } from "../../auth/schema";
import { addresses } from "../addresses/schema";
import { productVariants } from "../products/schema";
import { subscriptions } from "./schema";

export const subscriptionRelations = relations(subscriptions, ({ one }) => ({
  user: one(user, {
    fields: [subscriptions.userId],
    references: [user.id],
  }),
  variant: one(productVariants, {
    fields: [subscriptions.variantId],
    references: [productVariants.id],
  }),
  billingAddress: one(addresses, {
    fields: [subscriptions.billingAddressId],
    references: [addresses.id],
  }),
}));
