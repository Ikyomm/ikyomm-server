/** biome-ignore-all lint/suspicious/noExplicitAny: Drizzle query builders are intentionally passed through reusable helpers. */
import { getDB, musicPlaylists, musics } from "@ikyomm/database";
import { createTableListFetcher } from "@ikyomm/utils";
import { and, eq, inArray } from "drizzle-orm";
import type { MusicListQuery } from "./schema";

const fetchMusicBaseList = createTableListFetcher<
  typeof musics,
  typeof musics.$inferSelect,
  MusicListQuery
>({
  db: getDB,
  table: musics,
  where: ({ params }) =>
    and(
      eq(musics.isDeleted, params.isDeleted ?? false),
      params.playlistId ? eq(musics.playlistId, params.playlistId) : undefined
    ),
  search: {
    exact: [musics.id, musics.playlistId],
    prefix: [musics.name],
    contains: [musics.name, musics.fileUrl, musics.avatar],
  },
  sorting: {
    defaultBy: "createdAt",
    defaultOrder: "desc",
  },
  sortColumns: {
    id: musics.id,
    name: musics.name,
    playlistId: musics.playlistId,
    createdAt: musics.createdAt,
    updatedAt: musics.updatedAt,
  },
});

export const fetchMusicList = async (params: MusicListQuery) => {
  const response = await fetchMusicBaseList(params);
  const playlistIds = [...new Set(response.items.map((music) => music.playlistId))];

  if (playlistIds.length === 0) {
    return response;
  }

  const playlists = await getDB()
    .select({
      id: musicPlaylists.id,
      name: musicPlaylists.name,
    })
    .from(musicPlaylists)
    .where(inArray(musicPlaylists.id, playlistIds));
  const playlistById = new Map(playlists.map((playlist) => [playlist.id, playlist]));

  return {
    ...response,
    items: response.items.map((music) => ({
      ...music,
      playlist: playlistById.get(music.playlistId),
    })),
  };
};
