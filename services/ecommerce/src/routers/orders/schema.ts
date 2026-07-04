import { orderItems, orders, payments } from "@ikyomm/database";
import { createDbInsertSchema, createDbSelectSchema, createDbUpdateSchema } from "@ikyomm/utils";

const auditOmit = [
  "id",
  "createdAt",
  "updatedAt",
  "deletedAt",
  "isDeleted",
  "createdByUser",
  "updatedByUser",
  "deletedByUser",
] as const;

export const orderSchemas = {
  selectSchema: createDbSelectSchema(orders),
  insertSchema: createDbInsertSchema(orders, { omit: [...auditOmit, "userId"] }),
  updateSchema: createDbUpdateSchema(orders, { omit: [...auditOmit, "userId"] }),
};
export const orderItemSchemas = {
  selectSchema: createDbSelectSchema(orderItems),
  insertSchema: createDbInsertSchema(orderItems, { omit: auditOmit }),
  updateSchema: createDbUpdateSchema(orderItems, { omit: auditOmit }),
};
export const paymentSchemas = {
  selectSchema: createDbSelectSchema(payments),
  insertSchema: createDbInsertSchema(payments, { omit: auditOmit }),
  updateSchema: createDbUpdateSchema(payments, { omit: auditOmit }),
};
