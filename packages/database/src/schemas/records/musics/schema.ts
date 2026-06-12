import { index, pgTable, text } from "drizzle-orm/pg-core";
import { user } from "../../auth";
import { referenceColumns } from "../../reference-columns";

export const musicPlaylists = pgTable(
  "music_playlists",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    avatar: text("avatar").notNull(),
    ...referenceColumns(() => user.id),
  },
  (table) => [
    index("music_playlists_name_idx").on(table.name),
    index("music_playlists_isDeleted_createdAt_idx").on(table.isDeleted, table.createdAt),
    index("music_playlists_isDeleted_updatedAt_idx").on(table.isDeleted, table.updatedAt),
  ]
);

export const musics = pgTable(
  "musics",
  {
    id: text("id").primaryKey(),
    playlistId: text("playlist_id")
      .notNull()
      .references(() => musicPlaylists.id, { onDelete: "cascade" }),
    fileUrl: text("file_url").notNull(),
    avatar: text("avatar").notNull(),
    ...referenceColumns(() => user.id),
  },
  (table) => [
    index("musics_playlistId_idx").on(table.playlistId),
    index("musics_fileUrl_idx").on(table.fileUrl),
    index("musics_isDeleted_createdAt_idx").on(table.isDeleted, table.createdAt),
    index("musics_isDeleted_updatedAt_idx").on(table.isDeleted, table.updatedAt),
  ]
);
