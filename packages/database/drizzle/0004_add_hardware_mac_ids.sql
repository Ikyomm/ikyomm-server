ALTER TABLE "door_lock" ADD COLUMN IF NOT EXISTS "mac_id" text;--> statement-breakpoint
ALTER TABLE "aroma_defuser" ADD COLUMN IF NOT EXISTS "mac_id" text;--> statement-breakpoint
ALTER TABLE "touchpad" ADD COLUMN IF NOT EXISTS "mac_id" text;--> statement-breakpoint
ALTER TABLE "pods" ADD COLUMN IF NOT EXISTS "mac_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "door_lock_mac_id_uidx" ON "door_lock" USING btree ("mac_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "door_lock_mac_id_idx" ON "door_lock" USING btree ("mac_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "aroma_defuser_mac_id_uidx" ON "aroma_defuser" USING btree ("mac_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "aroma_defuser_mac_id_idx" ON "aroma_defuser" USING btree ("mac_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "touchpad_mac_id_uidx" ON "touchpad" USING btree ("mac_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "touchpad_mac_id_idx" ON "touchpad" USING btree ("mac_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "pods_mac_id_uidx" ON "pods" USING btree ("mac_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pods_mac_id_idx" ON "pods" USING btree ("mac_id");
