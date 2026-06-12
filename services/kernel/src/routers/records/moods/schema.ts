import { podMoodPresets } from "@ikyomm/database";
import {
  createDbInsertSchema,
  createDbSelectSchema,
  createDbUpdateSchema,
  createListQuerySchema,
  createListResponseSchema,
  optionalBooleanQuerySchema,
} from "@ikyomm/utils";
import { z } from "@hono/zod-openapi";

const rgbChannelSchema = z.number().int().min(0).max(255);

export const podMoodPresetRgbSchema = z.object({
  r: rgbChannelSchema,
  g: rgbChannelSchema,
  b: rgbChannelSchema,
});

export const podMoodPresetColorSchema = z.object({
  fixed: z.string().trim().min(1),
  gradient: z.string().trim().min(1),
});

export const podMoodPresetSchema = createDbSelectSchema(podMoodPresets).extend({
  rgb: podMoodPresetRgbSchema,
  color: podMoodPresetColorSchema,
  playlistIds: z.array(z.string().trim().min(1)),
  playlists: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
      })
    )
    .optional(),
});

const podMoodPresetCreateUpdateShape = {
  rgb: podMoodPresetRgbSchema,
  color: podMoodPresetColorSchema,
  title: z.string().trim().min(1),
  thumbnail: z.string().trim().min(1),
  icon: z.string().trim().min(1),
  playlistIds: z.array(z.string().trim().min(1)).default([]),
  defaultMusic: z.string().trim().min(1),
};

export const podMoodPresetCreateSchema = createDbInsertSchema(podMoodPresets, {
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
}).extend(podMoodPresetCreateUpdateShape);

export const podMoodPresetUpdateSchema = createDbUpdateSchema(podMoodPresets, {
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
  rgb: podMoodPresetRgbSchema.optional(),
  color: podMoodPresetColorSchema.optional(),
  title: z.string().trim().min(1).optional(),
  thumbnail: z.string().trim().min(1).optional(),
  icon: z.string().trim().min(1).optional(),
  playlistIds: z.array(z.string().trim().min(1)).optional(),
  defaultMusic: z.string().trim().min(1).optional(),
});

export const podMoodPresetListSortFields = [
  "id",
  "title",
  "defaultMusic",
  "createdAt",
  "updatedAt",
] as const;

export const podMoodPresetListQuerySchema = createListQuerySchema({
  sortFields: podMoodPresetListSortFields,
  extraShape: {
    isDeleted: optionalBooleanQuerySchema,
  },
});

export type PodMoodPresetListQuery = z.infer<typeof podMoodPresetListQuerySchema>;

export const podMoodPresetListResponseSchema = createListResponseSchema(podMoodPresetSchema);

export const podMoodPresetDeleteResponseSchema = z.object({
  message: z.string(),
});
