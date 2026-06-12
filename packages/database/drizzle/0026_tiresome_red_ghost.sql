ALTER TABLE "musics" ADD COLUMN "name" text DEFAULT 'Untitled Music' NOT NULL;--> statement-breakpoint
ALTER TABLE "musics" ALTER COLUMN "name" DROP DEFAULT;--> statement-breakpoint
CREATE INDEX "musics_name_idx" ON "musics" USING btree ("name");
