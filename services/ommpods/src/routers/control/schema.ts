import { z } from "@hono/zod-openapi";
import { rgbSchema, sessionResponseSchema } from "../shared";

export const moodControlBodySchema = z.object({
  moodPresetId: z.string().trim().min(1),
});

export const moodControlResponseSchema = sessionResponseSchema.extend({
  rgb: rgbSchema,
  moodPresetId: z.string().nullable(),
});

export const aromaControlBodySchema = z.object({
  activeDufuserContainerNumber: z.coerce.number().int().positive().nullable(),
});

export const aromaControlResponseSchema = sessionResponseSchema.extend({
  activeDufuserContainerNumber: z.number().int().positive().nullable(),
});
