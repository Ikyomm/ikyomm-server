import { relations } from "drizzle-orm";
import { musicPlaylists, musics } from "./musics";
import { pods } from "./pods";
import { zoneLocation } from "../location";

export const podRelations = relations(pods, ({ one }) => ({
  location: one(zoneLocation, {
    fields: [pods.locationId],
    references: [zoneLocation.id],
  }),
}));

export const musicPlaylistRelations = relations(musicPlaylists, ({ many }) => ({
  musics: many(musics),
}));

export const musicRelations = relations(musics, ({ one }) => ({
  playlist: one(musicPlaylists, {
    fields: [musics.playlistId],
    references: [musicPlaylists.id],
  }),
}));
