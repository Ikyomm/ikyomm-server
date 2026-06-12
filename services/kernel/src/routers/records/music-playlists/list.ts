/** biome-ignore-all lint/suspicious/noExplicitAny: Drizzle query builders are intentionally passed through reusable helpers. */
import { getDB, musicPlaylists, podMoodPresets } from "@ikyomm/database";
import { createTableListFetcher } from "@ikyomm/utils";
import { and, eq, sql } from "drizzle-orm";
import type { MusicPlaylistListQuery } from "./schema";

export const fetchMusicPlaylistList = createTableListFetcher<
  typeof musicPlaylists,
  typeof musicPlaylists.$inferSelect,
  MusicPlaylistListQuery
>({
  db: getDB,
  table: musicPlaylists,
  where: ({ params }) =>
    and(
      eq(musicPlaylists.isDeleted, params.isDeleted ?? false),
      params.moodPresetId
        ? sql`exists (
            select 1
            from ${podMoodPresets},
              jsonb_array_elements_text(${podMoodPresets.playlistIds}) as playlist_id(value)
            where ${podMoodPresets.id} = ${params.moodPresetId}
              and ${podMoodPresets.isDeleted} = false
              and playlist_id.value = ${musicPlaylists.id}
          )`
        : undefined
    ),
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
