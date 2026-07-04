import { z } from "@hono/zod-openapi";

const optionalBooleanQuerySchema = z
  .union([z.boolean(), z.enum(["true", "false"]).transform((value) => value === "true")])
  .optional();

export const ecommerceListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
  search: z.string().trim().min(1).optional(),
  sortBy: z.string().trim().min(1).optional(),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  isDeleted: optionalBooleanQuerySchema,
});

export const ecommerceDeleteResultSchema = z.object({
  id: z.string(),
  deleted: z.boolean(),
});

export const ecommerceRestoreResultSchema = z.object({
  id: z.string(),
  restored: z.boolean(),
});

export const ecommercePermanentDeleteResultSchema = z.object({
  id: z.string(),
  permanentlyDeleted: z.boolean(),
});
