/** biome-ignore-all lint/suspicious/noExplicitAny: Drizzle query builders are intentionally passed through reusable helpers. */
import { getDB, podMoodPresets } from "@ikyomm/database";
import { createTableListFetcher } from "@ikyomm/utils";
import { eq } from "drizzle-orm";
import type { PodMoodPresetListQuery } from "./schema";

export const fetchPodMoodPresetList = createTableListFetcher<
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
