/** biome-ignore-all lint/suspicious/noExplicitAny: Drizzle query builders are intentionally passed through reusable helpers. */
import { getDB, musicPlaylists, podMoodPresets } from "@ikyomm/database";
import { createTableListFetcher } from "@ikyomm/utils";
import { eq, inArray } from "drizzle-orm";
import type { PodMoodPresetListQuery } from "./schema";

const fetchPodMoodPresetBaseList = createTableListFetcher<
  typeof podMoodPresets,
  typeof podMoodPresets.$inferSelect,
  PodMoodPresetListQuery
>({
  db: getDB,
  table: podMoodPresets,
  where: ({ params }) => eq(podMoodPresets.isDeleted, params.isDeleted ?? false),
  search: {
    exact: [podMoodPresets.id],
    prefix: [podMoodPresets.title],
    contains: [
      podMoodPresets.title,
      podMoodPresets.description,
      podMoodPresets.defaultMusic,
      podMoodPresets.metadata,
    ],
  },
  sorting: {
    defaultBy: "createdAt",
    defaultOrder: "desc",
  },
  sortColumns: {
    id: podMoodPresets.id,
    title: podMoodPresets.title,
    defaultMusic: podMoodPresets.defaultMusic,
    createdAt: podMoodPresets.createdAt,
    updatedAt: podMoodPresets.updatedAt,
  },
});

export const fetchPodMoodPresetList = async (params: PodMoodPresetListQuery) => {
  const response = await fetchPodMoodPresetBaseList(params);
  const playlistIds = [
    ...new Set(response.items.flatMap((moodPreset) => moodPreset.playlistIds ?? [])),
  ];

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
    items: response.items.map((moodPreset) => ({
      ...moodPreset,
      playlists: (moodPreset.playlistIds ?? [])
        .map((playlistId) => playlistById.get(playlistId))
        .filter((playlist): playlist is (typeof playlists)[number] => Boolean(playlist)),
    })),
  };
};
