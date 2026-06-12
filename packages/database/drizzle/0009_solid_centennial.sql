CREATE TYPE "public"."sandbox_payment_status" AS ENUM('success', 'failed', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."sandbox_session_status" AS ENUM('pending', 'active', 'ended', 'expired', 'cancelled');--> statement-breakpoint
CREATE TABLE "sandbox_pod_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"pod_id" text NOT NULL,
	"user_id" text,
	"status" "sandbox_session_status" DEFAULT 'pending' NOT NULL,
	"minutes" integer DEFAULT 0 NOT NULL,
	"price_per_minute" real DEFAULT 10 NOT NULL,
	"total_amount" real DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"locked_at" timestamp,
	"started_at" timestamp,
	"ends_at" timestamp,
	"ended_at" timestamp,
	"metadata" jsonb,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by_user" text,
	"updated_by_user" text,
	"deleted_by_user" text,
	"is_deleted" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sandbox_usage_transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"pod_id" text NOT NULL,
	"user_id" text,
	"status" "sandbox_payment_status" DEFAULT 'success' NOT NULL,
	"amount" real DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"minutes" integer DEFAULT 0 NOT NULL,
	"payment_provider" text DEFAULT 'dummy' NOT NULL,
	"payment_reference" text NOT NULL,
	"metadata" jsonb,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by_user" text,
	"updated_by_user" text,
	"deleted_by_user" text,
	"is_deleted" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
DROP INDEX "pods_country_idx";--> statement-breakpoint
DROP INDEX "pods_state_idx";--> statement-breakpoint
DROP INDEX "pods_city_idx";--> statement-breakpoint
ALTER TABLE "zone_location" ADD COLUMN "type" text;--> statement-breakpoint
ALTER TABLE "sandbox_pod_sessions" ADD CONSTRAINT "sandbox_pod_sessions_pod_id_pods_id_fk" FOREIGN KEY ("pod_id") REFERENCES "public"."pods"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sandbox_pod_sessions" ADD CONSTRAINT "sandbox_pod_sessions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sandbox_pod_sessions" ADD CONSTRAINT "sandbox_pod_sessions_created_by_user_user_id_fk" FOREIGN KEY ("created_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sandbox_pod_sessions" ADD CONSTRAINT "sandbox_pod_sessions_updated_by_user_user_id_fk" FOREIGN KEY ("updated_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sandbox_pod_sessions" ADD CONSTRAINT "sandbox_pod_sessions_deleted_by_user_user_id_fk" FOREIGN KEY ("deleted_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sandbox_usage_transactions" ADD CONSTRAINT "sandbox_usage_transactions_session_id_sandbox_pod_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sandbox_pod_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sandbox_usage_transactions" ADD CONSTRAINT "sandbox_usage_transactions_pod_id_pods_id_fk" FOREIGN KEY ("pod_id") REFERENCES "public"."pods"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sandbox_usage_transactions" ADD CONSTRAINT "sandbox_usage_transactions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sandbox_usage_transactions" ADD CONSTRAINT "sandbox_usage_transactions_created_by_user_user_id_fk" FOREIGN KEY ("created_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sandbox_usage_transactions" ADD CONSTRAINT "sandbox_usage_transactions_updated_by_user_user_id_fk" FOREIGN KEY ("updated_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sandbox_usage_transactions" ADD CONSTRAINT "sandbox_usage_transactions_deleted_by_user_user_id_fk" FOREIGN KEY ("deleted_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sandbox_pod_sessions_pod_id_idx" ON "sandbox_pod_sessions" USING btree ("pod_id");--> statement-breakpoint
CREATE INDEX "sandbox_pod_sessions_user_id_idx" ON "sandbox_pod_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sandbox_pod_sessions_status_idx" ON "sandbox_pod_sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "sandbox_pod_sessions_ends_at_idx" ON "sandbox_pod_sessions" USING btree ("ends_at");--> statement-breakpoint
CREATE INDEX "sandbox_pod_sessions_created_at_idx" ON "sandbox_pod_sessions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "sandbox_usage_transactions_session_id_idx" ON "sandbox_usage_transactions" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "sandbox_usage_transactions_pod_id_idx" ON "sandbox_usage_transactions" USING btree ("pod_id");--> statement-breakpoint
CREATE INDEX "sandbox_usage_transactions_user_id_idx" ON "sandbox_usage_transactions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sandbox_usage_transactions_status_idx" ON "sandbox_usage_transactions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "sandbox_usage_transactions_created_at_idx" ON "sandbox_usage_transactions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "zone_location_type_idx" ON "zone_location" USING btree ("type");--> statement-breakpoint
ALTER TABLE "pods" DROP COLUMN "country";--> statement-breakpoint
ALTER TABLE "pods" DROP COLUMN "state";--> statement-breakpoint
ALTER TABLE "pods" DROP COLUMN "city";--> statement-breakpoint
ALTER TABLE "pods" DROP COLUMN "address";