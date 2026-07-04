import { inventory, warehouses } from "@ikyomm/database";
import { createDbInsertSchema, createDbSelectSchema, createDbUpdateSchema } from "@ikyomm/utils";

const insertOmit = [
  "id",
  "createdAt",
  "updatedAt",
  "deletedAt",
  "isDeleted",
  "createdByUser",
  "updatedByUser",
  "deletedByUser",
] as const;
const updateOmit = ["id", ...insertOmit.slice(1)] as const;

export const warehouseSchemas = {
  selectSchema: createDbSelectSchema(warehouses),
  insertSchema: createDbInsertSchema(warehouses, { omit: insertOmit }),
  updateSchema: createDbUpdateSchema(warehouses, { omit: updateOmit }),
};
export const inventorySchemas = {
  selectSchema: createDbSelectSchema(inventory),
  insertSchema: createDbInsertSchema(inventory, { omit: insertOmit }),
  updateSchema: createDbUpdateSchema(inventory, { omit: updateOmit }),
};
