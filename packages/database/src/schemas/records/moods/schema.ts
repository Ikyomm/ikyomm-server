import { index, jsonb, pgTable, text } from "drizzle-orm/pg-core";
import { user } from "../../auth";
import { referenceColumns } from "../../reference-columns";
import type { PodMoodPresetColor, PodMoodPresetRgb } from "./types";

export const podMoodPresets = pgTable(
  "pod_mood_presets",
  {
    id: text("id").primaryKey(),
    rgb: jsonb("rgb").$type<PodMoodPresetRgb>().notNull().default({ r: 255, g: 255, b: 255 }),
    title: text("title").notNull(),
    description: text("description"),
    thumbnail: text("thumbnail").notNull(),
    icon: text("icon").notNull(),
    color: jsonb("color")
      .$type<PodMoodPresetColor>()
      .notNull()
      .default({ fixed: "#FFFFFF", gradient: "linear-gradient(135deg, #FFFFFF, #E5E7EB)" }),
    playlistIds: jsonb("playlist_ids").$type<string[]>().notNull().default([]),
    defaultMusic: text("default_music").notNull(),
    metadata: text("metadata"),
    ...referenceColumns(() => user.id),
  },
  (table) => [
    index("pod_mood_presets_title_idx").on(table.title),
    index("pod_mood_presets_isDeleted_createdAt_idx").on(table.isDeleted, table.createdAt),
    index("pod_mood_presets_isDeleted_updatedAt_idx").on(table.isDeleted, table.updatedAt),
  ]
);
