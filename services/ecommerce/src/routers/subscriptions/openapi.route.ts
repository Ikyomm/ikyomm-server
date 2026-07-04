import { subscriptions } from "@ikyomm/database";
import type { CrudResourceConfig } from "../shared/crud";
import { subscriptionSchemas } from "./schema";
import { validateSubscriptionProduct } from "./utils";

export const subscriptionResources: CrudResourceConfig[] = [
  {
    name: "subscriptions",
    path: "",
    tag: "Subscriptions",
    table: subscriptions,
    ...subscriptionSchemas,
    ownerColumn: subscriptions.userId,
    ownerKey: "userId",
    beforeCreate: ({ body }) => validateSubscriptionProduct(body),
    beforeUpdate: ({ body }) =>
      body.variantId === undefined ? Promise.resolve(null) : validateSubscriptionProduct(body),
  },
];
