/** biome-ignore-all lint/suspicious/noExplicitAny: Drizzle query builders are intentionally passed through reusable helpers. */
import { getDB, musics } from "@ikyomm/database";
import { createTableListFetcher } from "@ikyomm/utils";
import { and, eq } from "drizzle-orm";
import type { MusicListQuery } from "./schema";

export const fetchMusicList = createTableListFetcher<
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
    contains: [musics.fileUrl, musics.avatar],
  },
  sorting: {
    defaultBy: "createdAt",
    defaultOrder: "desc",
  },
  sortColumns: {
    id: musics.id,
    playlistId: musics.playlistId,
    createdAt: musics.createdAt,
    updatedAt: musics.updatedAt,
  },
});
