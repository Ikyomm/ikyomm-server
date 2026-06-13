import { aromaDefusers } from "@ikyomm/database";
import {
  createDbInsertSchema,
  createDbSelectSchema,
  createDbUpdateSchema,
  createListQuerySchema,
  createListResponseSchema,
  optionalBooleanQuerySchema,
} from "@ikyomm/utils";
import { z } from "@hono/zod-openapi";

export const aromaDefuserContainerSchema = z.object({
  number: z.coerce.number().int().positive(),
  fragrance: z.string().trim().min(1),
});

export const aromaDefuserContainersSchema = z.array(aromaDefuserContainerSchema);

export const aromaDefuserSchema = createDbSelectSchema(aromaDefusers).extend({
  containers: aromaDefuserContainersSchema,
});

const aromaDefuserCreateUpdateShape = {
  name: z.string().trim().min(1).nullable().optional(),
  macId: z.string().trim().min(1),
  containers: aromaDefuserContainersSchema.default([]),
};

export const aromaDefuserCreateSchema = createDbInsertSchema(aromaDefusers, {
  omit: [
    "id",
    "createdAt",
    "updatedAt",
    "deletedAt",
    "isDeleted",
    "createdByUser",
    "updatedByUser",
    "deletedByUser",
  ],
}).extend(aromaDefuserCreateUpdateShape);

export const aromaDefuserUpdateSchema = createDbUpdateSchema(aromaDefusers, {
  omit: [
    "id",
    "createdAt",
    "updatedAt",
    "deletedAt",
    "isDeleted",
    "createdByUser",
    "updatedByUser",
    "deletedByUser",
  ],
}).extend({
  name: z.string().trim().min(1).nullable().optional(),
  macId: z.string().trim().min(1).optional(),
  containers: aromaDefuserContainersSchema.optional(),
});

export const aromaDefuserListSortFields = [
  "id",
  "name",
  "macId",
  "createdAt",
  "updatedAt",
] as const;

export const aromaDefuserListQuerySchema = createListQuerySchema({
  sortFields: aromaDefuserListSortFields,
  extraShape: {
    isDeleted: optionalBooleanQuerySchema,
  },
});

export type AromaDefuserListQuery = z.infer<typeof aromaDefuserListQuerySchema>;

export const aromaDefuserListResponseSchema = createListResponseSchema(aromaDefuserSchema);

export const aromaDefuserDeleteResponseSchema = z.object({
  message: z.string(),
});
