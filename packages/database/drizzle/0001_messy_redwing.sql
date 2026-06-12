CREATE TABLE "region" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by_user" text,
	"updated_by_user" text,
	"deleted_by_user" text,
	"is_deleted" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zone" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"region_id" text NOT NULL,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by_user" text,
	"updated_by_user" text,
	"deleted_by_user" text,
	"is_deleted" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zone_location" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"zone_id" text NOT NULL,
	"address" text,
	"latitude" text,
	"longitude" text,
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
ALTER TABLE "member" ADD COLUMN "region_id" text;--> statement-breakpoint
ALTER TABLE "member" ADD COLUMN "zone_id" text;--> statement-breakpoint
ALTER TABLE "member" ADD COLUMN "location_id" text;--> statement-breakpoint
ALTER TABLE "pods" ADD COLUMN "region_id" text;--> statement-breakpoint
ALTER TABLE "pods" ADD COLUMN "zone_id" text;--> statement-breakpoint
ALTER TABLE "pods" ADD COLUMN "location_id" text;--> statement-breakpoint
ALTER TABLE "region" ADD CONSTRAINT "region_created_by_user_user_id_fk" FOREIGN KEY ("created_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "region" ADD CONSTRAINT "region_updated_by_user_user_id_fk" FOREIGN KEY ("updated_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "region" ADD CONSTRAINT "region_deleted_by_user_user_id_fk" FOREIGN KEY ("deleted_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zone" ADD CONSTRAINT "zone_region_id_region_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."region"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zone" ADD CONSTRAINT "zone_created_by_user_user_id_fk" FOREIGN KEY ("created_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zone" ADD CONSTRAINT "zone_updated_by_user_user_id_fk" FOREIGN KEY ("updated_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zone" ADD CONSTRAINT "zone_deleted_by_user_user_id_fk" FOREIGN KEY ("deleted_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zone_location" ADD CONSTRAINT "zone_location_zone_id_zone_id_fk" FOREIGN KEY ("zone_id") REFERENCES "public"."zone"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zone_location" ADD CONSTRAINT "zone_location_created_by_user_user_id_fk" FOREIGN KEY ("created_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zone_location" ADD CONSTRAINT "zone_location_updated_by_user_user_id_fk" FOREIGN KEY ("updated_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zone_location" ADD CONSTRAINT "zone_location_deleted_by_user_user_id_fk" FOREIGN KEY ("deleted_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "region_name_uidx" ON "region" USING btree ("name");--> statement-breakpoint
CREATE INDEX "region_isDeleted_createdAt_idx" ON "region" USING btree ("is_deleted","created_at");--> statement-breakpoint
CREATE INDEX "region_isDeleted_updatedAt_idx" ON "region" USING btree ("is_deleted","updated_at");--> statement-breakpoint
CREATE INDEX "zone_regionId_idx" ON "zone" USING btree ("region_id");--> statement-breakpoint
CREATE UNIQUE INDEX "zone_regionId_name_uidx" ON "zone" USING btree ("region_id","name");--> statement-breakpoint
CREATE INDEX "zone_isDeleted_createdAt_idx" ON "zone" USING btree ("is_deleted","created_at");--> statement-breakpoint
CREATE INDEX "zone_isDeleted_updatedAt_idx" ON "zone" USING btree ("is_deleted","updated_at");--> statement-breakpoint
CREATE INDEX "zone_location_zoneId_idx" ON "zone_location" USING btree ("zone_id");--> statement-breakpoint
CREATE UNIQUE INDEX "zone_location_zoneId_name_uidx" ON "zone_location" USING btree ("zone_id","name");--> statement-breakpoint
CREATE INDEX "zone_location_isDeleted_createdAt_idx" ON "zone_location" USING btree ("is_deleted","created_at");--> statement-breakpoint
CREATE INDEX "zone_location_isDeleted_updatedAt_idx" ON "zone_location" USING btree ("is_deleted","updated_at");--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_region_id_region_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."region"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_zone_id_zone_id_fk" FOREIGN KEY ("zone_id") REFERENCES "public"."zone"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_location_id_zone_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."zone_location"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pods" ADD CONSTRAINT "pods_region_id_region_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."region"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pods" ADD CONSTRAINT "pods_zone_id_zone_id_fk" FOREIGN KEY ("zone_id") REFERENCES "public"."zone"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pods" ADD CONSTRAINT "pods_location_id_zone_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."zone_location"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "member_regionId_idx" ON "member" USING btree ("region_id");--> statement-breakpoint
CREATE INDEX "member_zoneId_idx" ON "member" USING btree ("zone_id");--> statement-breakpoint
CREATE INDEX "member_locationId_idx" ON "member" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "pods_regionId_idx" ON "pods" USING btree ("region_id");--> statement-breakpoint
CREATE INDEX "pods_zoneId_idx" ON "pods" USING btree ("zone_id");--> statement-breakpoint
CREATE INDEX "pods_locationId_idx" ON "pods" USING btree ("location_id");