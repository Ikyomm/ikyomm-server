CREATE TYPE "public"."pod_session_log_event_type" AS ENUM('SESSION_CREATED', 'MOOD_CHANGED', 'AROMA_CHANGED');--> statement-breakpoint
CREATE TYPE "public"."pod_session_status" AS ENUM('CONFIRMED', 'CANCELLED', 'COMPLETED');--> statement-breakpoint
CREATE TABLE "aroma_defuser" (
	"id" text PRIMARY KEY NOT NULL,
	"mac_id" text NOT NULL,
	"containers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by_user" text,
	"updated_by_user" text,
	"deleted_by_user" text,
	"is_deleted" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pod_session_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"event_type" "pod_session_log_event_type" NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"occurred_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by_user" text,
	"updated_by_user" text,
	"deleted_by_user" text,
	"is_deleted" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pod_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"pod_id" text NOT NULL,
	"user_id" text NOT NULL,
	"company_id" text,
	"status" "pod_session_status" DEFAULT 'CONFIRMED' NOT NULL,
	"start_at" timestamp NOT NULL,
	"end_at" timestamp NOT NULL,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by_user" text,
	"updated_by_user" text,
	"deleted_by_user" text,
	"is_deleted" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pods" ADD COLUMN "aroma_defuser_id" text;--> statement-breakpoint
ALTER TABLE "aroma_defuser" ADD CONSTRAINT "aroma_defuser_created_by_user_user_id_fk" FOREIGN KEY ("created_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aroma_defuser" ADD CONSTRAINT "aroma_defuser_updated_by_user_user_id_fk" FOREIGN KEY ("updated_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aroma_defuser" ADD CONSTRAINT "aroma_defuser_deleted_by_user_user_id_fk" FOREIGN KEY ("deleted_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pod_session_logs" ADD CONSTRAINT "pod_session_logs_session_id_pod_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."pod_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pod_session_logs" ADD CONSTRAINT "pod_session_logs_created_by_user_user_id_fk" FOREIGN KEY ("created_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pod_session_logs" ADD CONSTRAINT "pod_session_logs_updated_by_user_user_id_fk" FOREIGN KEY ("updated_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pod_session_logs" ADD CONSTRAINT "pod_session_logs_deleted_by_user_user_id_fk" FOREIGN KEY ("deleted_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pod_sessions" ADD CONSTRAINT "pod_sessions_pod_id_pods_id_fk" FOREIGN KEY ("pod_id") REFERENCES "public"."pods"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pod_sessions" ADD CONSTRAINT "pod_sessions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pod_sessions" ADD CONSTRAINT "pod_sessions_company_id_organization_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pod_sessions" ADD CONSTRAINT "pod_sessions_created_by_user_user_id_fk" FOREIGN KEY ("created_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pod_sessions" ADD CONSTRAINT "pod_sessions_updated_by_user_user_id_fk" FOREIGN KEY ("updated_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pod_sessions" ADD CONSTRAINT "pod_sessions_deleted_by_user_user_id_fk" FOREIGN KEY ("deleted_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "aroma_defuser_macId_uidx" ON "aroma_defuser" USING btree ("mac_id");--> statement-breakpoint
CREATE INDEX "aroma_defuser_macId_idx" ON "aroma_defuser" USING btree ("mac_id");--> statement-breakpoint
CREATE INDEX "aroma_defuser_isDeleted_createdAt_idx" ON "aroma_defuser" USING btree ("is_deleted","created_at");--> statement-breakpoint
CREATE INDEX "aroma_defuser_isDeleted_updatedAt_idx" ON "aroma_defuser" USING btree ("is_deleted","updated_at");--> statement-breakpoint
CREATE INDEX "pod_session_logs_sessionId_occurredAt_idx" ON "pod_session_logs" USING btree ("session_id","occurred_at");--> statement-breakpoint
CREATE INDEX "pod_session_logs_eventType_idx" ON "pod_session_logs" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "pod_session_logs_isDeleted_createdAt_idx" ON "pod_session_logs" USING btree ("is_deleted","created_at");--> statement-breakpoint
CREATE INDEX "pod_sessions_podId_status_endAt_idx" ON "pod_sessions" USING btree ("pod_id","status","end_at");--> statement-breakpoint
CREATE INDEX "pod_sessions_userId_idx" ON "pod_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "pod_sessions_companyId_idx" ON "pod_sessions" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "pod_sessions_startAt_idx" ON "pod_sessions" USING btree ("start_at");--> statement-breakpoint
CREATE INDEX "pod_sessions_endAt_idx" ON "pod_sessions" USING btree ("end_at");--> statement-breakpoint
CREATE INDEX "pod_sessions_isDeleted_createdAt_idx" ON "pod_sessions" USING btree ("is_deleted","created_at");--> statement-breakpoint
ALTER TABLE "pods" ADD CONSTRAINT "pods_aroma_defuser_id_aroma_defuser_id_fk" FOREIGN KEY ("aroma_defuser_id") REFERENCES "public"."aroma_defuser"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pods_aromaDefuserId_idx" ON "pods" USING btree ("aroma_defuser_id");--> statement-breakpoint
ALTER TABLE "pods" DROP COLUMN "pod_session_status";
