import { categories } from "@ikyomm/database";
import { createDbInsertSchema, createDbSelectSchema, createDbUpdateSchema } from "@ikyomm/utils";

const omit = [
  "id",
  "createdAt",
  "updatedAt",
  "deletedAt",
  "isDeleted",
  "createdByUser",
  "updatedByUser",
  "deletedByUser",
] as const;

export const categorySchemas = {
  selectSchema: createDbSelectSchema(categories),
  insertSchema: createDbInsertSchema(categories, { omit }),
  updateSchema: createDbUpdateSchema(categories, { omit }),
};
