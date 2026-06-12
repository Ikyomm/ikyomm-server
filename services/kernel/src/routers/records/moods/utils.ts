import { db, podMoodPresets } from "@ikyomm/database";
import { and, eq, ne } from "drizzle-orm";

type IncludeDeletedOptions = {
  includeDeleted?: boolean;
};

export async function findPodMoodPresetById(id: string, options?: IncludeDeletedOptions) {
  return db.query.podMoodPresets.findFirst({
    where: options?.includeDeleted
      ? eq(podMoodPresets.id, id)
      : and(eq(podMoodPresets.id, id), eq(podMoodPresets.isDeleted, false)),
  });
}

export async function findPodMoodPresetByTitle(title: string, excludeId?: string) {
  return db.query.podMoodPresets.findFirst({
    columns: {
      id: true,
      title: true,
    },
    where: and(
      eq(podMoodPresets.title, title),
      eq(podMoodPresets.isDeleted, false),
      excludeId ? ne(podMoodPresets.id, excludeId) : undefined
    ),
  });
}
