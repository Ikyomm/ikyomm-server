CREATE TABLE "pod_mood_presets" (
	"id" text PRIMARY KEY NOT NULL,
	"rgb" jsonb DEFAULT '{"r":255,"g":255,"b":255}'::jsonb NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"thumbnail" text NOT NULL,
	"icon" text NOT NULL,
	"color" jsonb DEFAULT '{"fixed":"#FFFFFF","gradient":"linear-gradient(135deg, #FFFFFF, #E5E7EB)"}'::jsonb NOT NULL,
	"default_music" text NOT NULL,
	"metadata" text,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by_user" text,
	"updated_by_user" text,
	"deleted_by_user" text,
	"is_deleted" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
DROP INDEX "pods_mac_id_uidx";--> statement-breakpoint
DROP INDEX "pods_mac_id_idx";--> statement-breakpoint
ALTER TABLE "pod_mood_presets" ADD CONSTRAINT "pod_mood_presets_created_by_user_user_id_fk" FOREIGN KEY ("created_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pod_mood_presets" ADD CONSTRAINT "pod_mood_presets_updated_by_user_user_id_fk" FOREIGN KEY ("updated_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pod_mood_presets" ADD CONSTRAINT "pod_mood_presets_deleted_by_user_user_id_fk" FOREIGN KEY ("deleted_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pod_mood_presets_title_idx" ON "pod_mood_presets" USING btree ("title");--> statement-breakpoint
CREATE INDEX "pod_mood_presets_isDeleted_createdAt_idx" ON "pod_mood_presets" USING btree ("is_deleted","created_at");--> statement-breakpoint
CREATE INDEX "pod_mood_presets_isDeleted_updatedAt_idx" ON "pod_mood_presets" USING btree ("is_deleted","updated_at");--> statement-breakpoint
ALTER TABLE "pods" DROP COLUMN "mac_id";