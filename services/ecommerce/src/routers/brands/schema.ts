import { brands } from "@ikyomm/database";
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

export const brandSchemas = {
  selectSchema: createDbSelectSchema(brands),
  insertSchema: createDbInsertSchema(brands, { omit }),
  updateSchema: createDbUpdateSchema(brands, { omit }),
};
