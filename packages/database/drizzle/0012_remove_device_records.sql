ALTER TABLE "pods" DROP CONSTRAINT IF EXISTS "pods_door_lock_id_door_lock_id_fk";
ALTER TABLE "pods" DROP CONSTRAINT IF EXISTS "pods_aroma_defuser_id_aroma_defuser_id_fk";
ALTER TABLE "pods" DROP CONSTRAINT IF EXISTS "pods_touchpad_id_touchpad_id_fk";

DROP INDEX IF EXISTS "pods_door_lock_id_uidx";
DROP INDEX IF EXISTS "pods_aroma_defuser_id_uidx";
DROP INDEX IF EXISTS "pods_touchpad_id_uidx";
DROP INDEX IF EXISTS "pods_mac_id_uidx";
DROP INDEX IF EXISTS "pods_mac_id_idx";

ALTER TABLE "pods" DROP COLUMN IF EXISTS "door_lock_id";
ALTER TABLE "pods" DROP COLUMN IF EXISTS "aroma_defuser_id";
ALTER TABLE "pods" DROP COLUMN IF EXISTS "touchpad_id";
ALTER TABLE "pods" DROP COLUMN IF EXISTS "mac_id";
ALTER TABLE "pods" DROP COLUMN IF EXISTS "metadata";
ALTER TABLE "pods" ADD COLUMN IF NOT EXISTS "connected_device_config" jsonb NOT NULL DEFAULT '[]'::jsonb;

DROP TABLE IF EXISTS "door_lock";
DROP TABLE IF EXISTS "aroma_defuser";
DROP TABLE IF EXISTS "touchpad";
DROP TYPE IF EXISTS "door_lock_device_status";
