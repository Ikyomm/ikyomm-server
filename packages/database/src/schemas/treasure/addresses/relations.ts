import { relations } from "drizzle-orm";
import { user } from "../../auth/schema";
import { orders } from "../orders/schema";
import { subscriptions } from "../subscriptions/schema";
import { addresses } from "./schema";

export const addressRelations = relations(addresses, ({ many, one }) => ({
  user: one(user, {
    fields: [addresses.userId],
    references: [user.id],
  }),
  billingOrders: many(orders, { relationName: "treasureOrderBillingAddress" }),
  shippingOrders: many(orders, { relationName: "treasureOrderShippingAddress" }),
  subscriptions: many(subscriptions),
}));
