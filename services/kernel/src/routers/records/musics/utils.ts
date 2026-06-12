import { db, musics } from "@ikyomm/database";
import { and, eq } from "drizzle-orm";

type IncludeDeletedOptions = {
  includeDeleted?: boolean;
};

export async function findMusicById(id: string, options?: IncludeDeletedOptions) {
  return db.query.musics.findFirst({
    where: options?.includeDeleted
      ? eq(musics.id, id)
      : and(eq(musics.id, id), eq(musics.isDeleted, false)),
  });
}
