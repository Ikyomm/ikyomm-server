CREATE TABLE IF NOT EXISTS "music_playlists" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "avatar" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "deleted_at" timestamp,
  "is_deleted" boolean DEFAULT false NOT NULL,
  "created_by_user" text,
  "updated_by_user" text,
  "deleted_by_user" text
);

CREATE TABLE IF NOT EXISTS "musics" (
  "id" text PRIMARY KEY NOT NULL,
  "playlist_id" text NOT NULL,
  "file_url" text NOT NULL,
  "avatar" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "deleted_at" timestamp,
  "is_deleted" boolean DEFAULT false NOT NULL,
  "created_by_user" text,
  "updated_by_user" text,
  "deleted_by_user" text
);

ALTER TABLE "music_playlists" ADD CONSTRAINT "music_playlists_created_by_user_user_id_fk" FOREIGN KEY ("created_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "music_playlists" ADD CONSTRAINT "music_playlists_updated_by_user_user_id_fk" FOREIGN KEY ("updated_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "music_playlists" ADD CONSTRAINT "music_playlists_deleted_by_user_user_id_fk" FOREIGN KEY ("deleted_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;

ALTER TABLE "musics" ADD CONSTRAINT "musics_playlist_id_music_playlists_id_fk" FOREIGN KEY ("playlist_id") REFERENCES "public"."music_playlists"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "musics" ADD CONSTRAINT "musics_created_by_user_user_id_fk" FOREIGN KEY ("created_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "musics" ADD CONSTRAINT "musics_updated_by_user_user_id_fk" FOREIGN KEY ("updated_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "musics" ADD CONSTRAINT "musics_deleted_by_user_user_id_fk" FOREIGN KEY ("deleted_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;

CREATE INDEX IF NOT EXISTS "music_playlists_name_idx" ON "music_playlists" USING btree ("name");
CREATE INDEX IF NOT EXISTS "music_playlists_isDeleted_createdAt_idx" ON "music_playlists" USING btree ("is_deleted","created_at");
CREATE INDEX IF NOT EXISTS "music_playlists_isDeleted_updatedAt_idx" ON "music_playlists" USING btree ("is_deleted","updated_at");

CREATE INDEX IF NOT EXISTS "musics_playlistId_idx" ON "musics" USING btree ("playlist_id");
CREATE INDEX IF NOT EXISTS "musics_fileUrl_idx" ON "musics" USING btree ("file_url");
CREATE INDEX IF NOT EXISTS "musics_isDeleted_createdAt_idx" ON "musics" USING btree ("is_deleted","created_at");
CREATE INDEX IF NOT EXISTS "musics_isDeleted_updatedAt_idx" ON "musics" USING btree ("is_deleted","updated_at");
