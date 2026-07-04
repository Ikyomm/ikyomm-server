import { reviews } from "@ikyomm/database";
import { createDbInsertSchema, createDbSelectSchema, createDbUpdateSchema } from "@ikyomm/utils";

const omit = [
  "id",
  "userId",
  "status",
  "createdAt",
  "updatedAt",
  "deletedAt",
  "isDeleted",
  "createdByUser",
  "updatedByUser",
  "deletedByUser",
] as const;

export const reviewSchemas = {
  selectSchema: createDbSelectSchema(reviews),
  insertSchema: createDbInsertSchema(reviews, { omit }),
  updateSchema: createDbUpdateSchema(reviews, { omit }),
};
