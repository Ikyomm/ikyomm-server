/** biome-ignore-all lint/suspicious/noExplicitAny: Drizzle query builders are intentionally passed through reusable helpers. */
import { getDB, musicPlaylists } from "@ikyomm/database";
import { createTableListFetcher } from "@ikyomm/utils";
import { eq } from "drizzle-orm";
import type { MusicPlaylistListQuery } from "./schema";

export const fetchMusicPlaylistList = createTableListFetcher<
  typeof musicPlaylists,
  typeof musicPlaylists.$inferSelect,
  MusicPlaylistListQuery
>({
  db: getDB,
  table: musicPlaylists,
  where: ({ params }) => eq(musicPlaylists.isDeleted, params.isDeleted ?? false),
  search: {
    exact: [musicPlaylists.id],
    prefix: [musicPlaylists.name],
    contains: [musicPlaylists.name, musicPlaylists.description, musicPlaylists.avatar],
  },
  sorting: {
    defaultBy: "createdAt",
    defaultOrder: "desc",
  },
  sortColumns: {
    id: musicPlaylists.id,
    name: musicPlaylists.name,
    createdAt: musicPlaylists.createdAt,
    updatedAt: musicPlaylists.updatedAt,
  },
});
