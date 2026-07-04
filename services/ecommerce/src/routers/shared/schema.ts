import { z } from "@hono/zod-openapi";

export const ecommerceListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
});

export const ecommerceDeleteResultSchema = z.object({
  id: z.string(),
  deleted: z.boolean(),
});

export const ecommerceRestoreResultSchema = z.object({
  id: z.string(),
  restored: z.boolean(),
});
