import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppBindings } from "@/types/app";
import { musicPlaylistsGroup } from "./music-playlists/handler";
import { musicsGroup } from "./musics/handler";
import { moodPresetsGroup } from "./moods/handler";
import { podsGroup } from "./pods/handler";

export const recordsGroup = new OpenAPIHono<AppBindings>();

recordsGroup.route("/music-playlists", musicPlaylistsGroup);
recordsGroup.route("/musics", musicsGroup);
recordsGroup.route("/mood-presets", moodPresetsGroup);
recordsGroup.route("/pods", podsGroup);
