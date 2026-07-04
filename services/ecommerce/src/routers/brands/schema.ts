import { brands } from "@ikyomm/database";
import { z } from "@hono/zod-openapi";
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

export const brandCategoryAssignmentSchema = z.object({
  categoryIds: z.array(z.string().min(1)),
});

export const brandCategoryAssignmentResultSchema = z.object({
  brandId: z.string(),
  categoryIds: z.array(z.string()),
});
