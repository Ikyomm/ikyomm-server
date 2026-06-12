DROP TABLE "credit_requests" CASCADE;--> statement-breakpoint
DROP TABLE "credit_transactions" CASCADE;--> statement-breakpoint
DROP TABLE "sandbox_pod_sessions" CASCADE;--> statement-breakpoint
DROP TABLE "sandbox_usage_transactions" CASCADE;--> statement-breakpoint
ALTER TABLE "organization" DROP COLUMN "credit_minutes";--> statement-breakpoint
ALTER TABLE "organization" DROP COLUMN "currency_type";--> statement-breakpoint
ALTER TABLE "organization" DROP COLUMN "credit_balance";--> statement-breakpoint
DROP TYPE "public"."request_status";--> statement-breakpoint
DROP TYPE "public"."transaction_status";--> statement-breakpoint
DROP TYPE "public"."sandbox_payment_status";--> statement-breakpoint
DROP TYPE "public"."sandbox_session_status";