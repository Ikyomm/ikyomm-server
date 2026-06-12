ALTER TABLE "pod_mood_presets"
  ADD COLUMN IF NOT EXISTS "playlist_ids" jsonb DEFAULT '[]'::jsonb NOT NULL;

DROP INDEX IF EXISTS "music_playlists_moodPresetId_idx";

ALTER TABLE "music_playlists"
  DROP CONSTRAINT IF EXISTS "music_playlists_mood_preset_id_pod_mood_presets_id_fk";

ALTER TABLE "music_playlists"
  DROP COLUMN IF EXISTS "mood_preset_id";
