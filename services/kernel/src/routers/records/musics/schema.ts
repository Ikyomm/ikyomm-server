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

export const musicSchema = createDbSelectSchema(musics);

const musicCreateUpdateShape = {
  playlistId: z.string().trim().min(1),
  fileUrl: z.string().trim().min(1),
  avatar: z.string().trim().min(1),
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
  playlistId: z.string().trim().min(1).optional(),
  fileUrl: z.string().trim().min(1).optional(),
  avatar: z.string().trim().min(1).optional(),
});

export const musicListSortFields = ["id", "playlistId", "createdAt", "updatedAt"] as const;

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
