import { db, musicPlaylists } from "@ikyomm/database";
import { and, eq, ne } from "drizzle-orm";

type IncludeDeletedOptions = {
  includeDeleted?: boolean;
};

export async function findMusicPlaylistById(id: string, options?: IncludeDeletedOptions) {
  return db.query.musicPlaylists.findFirst({
    where: options?.includeDeleted
      ? eq(musicPlaylists.id, id)
      : and(eq(musicPlaylists.id, id), eq(musicPlaylists.isDeleted, false)),
  });
}

export async function findMusicPlaylistByName(name: string, excludeId?: string) {
  return db.query.musicPlaylists.findFirst({
    columns: {
      id: true,
      name: true,
    },
    where: and(
      eq(musicPlaylists.name, name),
      eq(musicPlaylists.isDeleted, false),
      excludeId ? ne(musicPlaylists.id, excludeId) : undefined
    ),
  });
}
