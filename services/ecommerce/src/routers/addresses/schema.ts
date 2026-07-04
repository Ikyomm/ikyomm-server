import { addresses } from "@ikyomm/database";
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

export const addressSchemas = {
  selectSchema: createDbSelectSchema(addresses),
  insertSchema: createDbInsertSchema(addresses, { omit }),
  updateSchema: createDbUpdateSchema(addresses, { omit }),
};
