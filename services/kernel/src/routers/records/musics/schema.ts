import { musics } from "@ikyomm/database";
import {
  createDbInsertSchema,
  createDbSelectSchema,
  createDbUpdateSchema,
  createListQuerySchema,
  createListResponseSchema,
  optionalBooleanQuerySchema,
} from "@ikyomm/utils";
import { z } from "@hono/zod-openapi";

export const musicSchema = createDbSelectSchema(musics).extend({
  playlist: z
    .object({
      id: z.string(),
      name: z.string(),
    })
    .optional(),
});

const optionalAvatarSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? null : value),
  z.string().trim().min(1).nullable().optional()
);

const musicCreateUpdateShape = {
  name: z.string().trim().min(1),
  playlistId: z.string().trim().min(1),
  fileUrl: z.string().trim().min(1),
  avatar: optionalAvatarSchema,
};

export const musicCreateSchema = createDbInsertSchema(musics, {
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
}).extend(musicCreateUpdateShape);

export const musicUpdateSchema = createDbUpdateSchema(musics, {
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
  name: z.string().trim().min(1).optional(),
  playlistId: z.string().trim().min(1).optional(),
  fileUrl: z.string().trim().min(1).optional(),
  avatar: optionalAvatarSchema,
});

export const musicListSortFields = ["id", "name", "playlistId", "createdAt", "updatedAt"] as const;

export const musicListQuerySchema = createListQuerySchema({
  sortFields: musicListSortFields,
  extraShape: {
    isDeleted: optionalBooleanQuerySchema,
    playlistId: z.string().trim().min(1).optional(),
  },
});

export type MusicListQuery = z.infer<typeof musicListQuerySchema>;

export const musicListResponseSchema = createListResponseSchema(musicSchema);

export const musicDeleteResponseSchema = z.object({
  message: z.string(),
});
