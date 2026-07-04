import { addresses } from "@ikyomm/database";
import { z } from "@hono/zod-openapi";
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

export const orderAddressSnapshotSchema = z.object({
  recipientName: z.string(),
  phoneNumber: z.string().nullable().optional(),
  addressLine1: z.string(),
  addressLine2: z.string().nullable().optional(),
  city: z.string(),
  state: z.string(),
  country: z.string(),
  pincode: z.string(),
});

const orderAddressEntrySchema = z.object({
  address: addressSchemas.selectSchema.nullable(),
  snapshot: orderAddressSnapshotSchema,
});

export const orderAddressesResultSchema = z.object({
  orderId: z.string(),
  userId: z.string(),
  billing: orderAddressEntrySchema,
  shipping: orderAddressEntrySchema,
});
