ALTER TABLE "organization" RENAME COLUMN "currency_type" TO "credit_balance_currency_type";--> statement-breakpoint
ALTER TABLE "aroma_defuser" ADD COLUMN "mac_id" text;--> statement-breakpoint
ALTER TABLE "door_lock" ADD COLUMN "mac_id" text;--> statement-breakpoint
ALTER TABLE "touchpad" ADD COLUMN "mac_id" text;--> statement-breakpoint
ALTER TABLE "pods" ADD COLUMN "mac_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX "aroma_defuser_mac_id_uidx" ON "aroma_defuser" USING btree ("mac_id");--> statement-breakpoint
CREATE INDEX "aroma_defuser_mac_id_idx" ON "aroma_defuser" USING btree ("mac_id");--> statement-breakpoint
CREATE UNIQUE INDEX "door_lock_mac_id_uidx" ON "door_lock" USING btree ("mac_id");--> statement-breakpoint
CREATE INDEX "door_lock_mac_id_idx" ON "door_lock" USING btree ("mac_id");--> statement-breakpoint
CREATE UNIQUE INDEX "touchpad_mac_id_uidx" ON "touchpad" USING btree ("mac_id");--> statement-breakpoint
CREATE INDEX "touchpad_mac_id_idx" ON "touchpad" USING btree ("mac_id");--> statement-breakpoint
CREATE UNIQUE INDEX "pods_mac_id_uidx" ON "pods" USING btree ("mac_id");--> statement-breakpoint
CREATE INDEX "pods_mac_id_idx" ON "pods" USING btree ("mac_id");