import { subcategories } from "@ikyomm/database";
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

export const subcategorySchemas = {
  selectSchema: createDbSelectSchema(subcategories),
  insertSchema: createDbInsertSchema(subcategories, { omit }),
  updateSchema: createDbUpdateSchema(subcategories, { omit }),
};
