import { subscriptions } from "@ikyomm/database";
import { createDbInsertSchema, createDbSelectSchema, createDbUpdateSchema } from "@ikyomm/utils";

const omit = [
  "id",
  "userId",
  "createdAt",
  "updatedAt",
  "deletedAt",
  "isDeleted",
  "createdByUser",
  "updatedByUser",
  "deletedByUser",
] as const;

export const subscriptionSchemas = {
  selectSchema: createDbSelectSchema(subscriptions),
  insertSchema: createDbInsertSchema(subscriptions, { omit }),
  updateSchema: createDbUpdateSchema(subscriptions, { omit }),
};
