import { musicPlaylists } from "@ikyomm/database";
import {
  createDbInsertSchema,
  createDbSelectSchema,
  createDbUpdateSchema,
  createListQuerySchema,
  createListResponseSchema,
  optionalBooleanQuerySchema,
} from "@ikyomm/utils";
import { z } from "@hono/zod-openapi";

export const musicPlaylistSchema = createDbSelectSchema(musicPlaylists);

const musicPlaylistCreateUpdateShape = {
  name: z.string().trim().min(1),
  avatar: z.string().trim().min(1),
};

export const musicPlaylistCreateSchema = createDbInsertSchema(musicPlaylists, {
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
}).extend(musicPlaylistCreateUpdateShape);

export const musicPlaylistUpdateSchema = createDbUpdateSchema(musicPlaylists, {
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
  avatar: z.string().trim().min(1).optional(),
});

export const musicPlaylistListSortFields = ["id", "name", "createdAt", "updatedAt"] as const;

export const musicPlaylistListQuerySchema = createListQuerySchema({
  sortFields: musicPlaylistListSortFields,
  extraShape: {
    isDeleted: optionalBooleanQuerySchema,
  },
});

export type MusicPlaylistListQuery = z.infer<typeof musicPlaylistListQuerySchema>;

export const musicPlaylistListResponseSchema = createListResponseSchema(musicPlaylistSchema);

export const musicPlaylistDeleteResponseSchema = z.object({
  message: z.string(),
});
