CREATE TYPE "public"."wallet_transaction_status" AS ENUM('PENDING', 'COMPLETED', 'FAILED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."wallet_transaction_type" AS ENUM('TRANSFER', 'CREDIT', 'DEBIT', 'ADJUSTMENT');--> statement-breakpoint
CREATE TABLE "ikyomm_wallet" (
	"id" text PRIMARY KEY NOT NULL,
	"singleton_key" text DEFAULT 'ikyomm' NOT NULL,
	"credit_minute" real DEFAULT 0 NOT NULL,
	"reference" text,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by_user" text,
	"updated_by_user" text,
	"deleted_by_user" text,
	"is_deleted" boolean DEFAULT false NOT NULL,
	CONSTRAINT "ikyomm_wallet_singletonKey_check" CHECK ("ikyomm_wallet"."singleton_key" = 'ikyomm')
);
--> statement-breakpoint
CREATE TABLE "organization_wallet" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"credit_minute" real DEFAULT 0 NOT NULL,
	"reference" text,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by_user" text,
	"updated_by_user" text,
	"deleted_by_user" text,
	"is_deleted" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_wallet" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"credit_minute" real DEFAULT 0 NOT NULL,
	"reference" text,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by_user" text,
	"updated_by_user" text,
	"deleted_by_user" text,
	"is_deleted" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wallet_transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"type" "wallet_transaction_type" DEFAULT 'TRANSFER' NOT NULL,
	"status" "wallet_transaction_status" DEFAULT 'COMPLETED' NOT NULL,
	"credit_minute" real NOT NULL,
	"reference" text,
	"description" text,
	"transacted_at" timestamp DEFAULT now() NOT NULL,
	"from_user_wallet_id" text,
	"from_organization_wallet_id" text,
	"from_ikyomm_wallet_id" text,
	"to_user_wallet_id" text,
	"to_organization_wallet_id" text,
	"to_ikyomm_wallet_id" text,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by_user" text,
	"updated_by_user" text,
	"deleted_by_user" text,
	"is_deleted" boolean DEFAULT false NOT NULL,
	CONSTRAINT "wallet_transactions_creditMinute_check" CHECK ("wallet_transactions"."credit_minute" > 0),
	CONSTRAINT "wallet_transactions_single_source_check" CHECK (num_nonnulls("wallet_transactions"."from_user_wallet_id", "wallet_transactions"."from_organization_wallet_id", "wallet_transactions"."from_ikyomm_wallet_id") = 1),
	CONSTRAINT "wallet_transactions_single_destination_check" CHECK (num_nonnulls("wallet_transactions"."to_user_wallet_id", "wallet_transactions"."to_organization_wallet_id", "wallet_transactions"."to_ikyomm_wallet_id") = 1)
);
--> statement-breakpoint
ALTER TABLE "ikyomm_wallet" ADD CONSTRAINT "ikyomm_wallet_created_by_user_user_id_fk" FOREIGN KEY ("created_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ikyomm_wallet" ADD CONSTRAINT "ikyomm_wallet_updated_by_user_user_id_fk" FOREIGN KEY ("updated_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ikyomm_wallet" ADD CONSTRAINT "ikyomm_wallet_deleted_by_user_user_id_fk" FOREIGN KEY ("deleted_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_wallet" ADD CONSTRAINT "organization_wallet_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_wallet" ADD CONSTRAINT "organization_wallet_created_by_user_user_id_fk" FOREIGN KEY ("created_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_wallet" ADD CONSTRAINT "organization_wallet_updated_by_user_user_id_fk" FOREIGN KEY ("updated_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_wallet" ADD CONSTRAINT "organization_wallet_deleted_by_user_user_id_fk" FOREIGN KEY ("deleted_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_wallet" ADD CONSTRAINT "user_wallet_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_wallet" ADD CONSTRAINT "user_wallet_created_by_user_user_id_fk" FOREIGN KEY ("created_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_wallet" ADD CONSTRAINT "user_wallet_updated_by_user_user_id_fk" FOREIGN KEY ("updated_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_wallet" ADD CONSTRAINT "user_wallet_deleted_by_user_user_id_fk" FOREIGN KEY ("deleted_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_from_user_wallet_id_user_wallet_id_fk" FOREIGN KEY ("from_user_wallet_id") REFERENCES "public"."user_wallet"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_from_organization_wallet_id_organization_wallet_id_fk" FOREIGN KEY ("from_organization_wallet_id") REFERENCES "public"."organization_wallet"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_from_ikyomm_wallet_id_ikyomm_wallet_id_fk" FOREIGN KEY ("from_ikyomm_wallet_id") REFERENCES "public"."ikyomm_wallet"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_to_user_wallet_id_user_wallet_id_fk" FOREIGN KEY ("to_user_wallet_id") REFERENCES "public"."user_wallet"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_to_organization_wallet_id_organization_wallet_id_fk" FOREIGN KEY ("to_organization_wallet_id") REFERENCES "public"."organization_wallet"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_to_ikyomm_wallet_id_ikyomm_wallet_id_fk" FOREIGN KEY ("to_ikyomm_wallet_id") REFERENCES "public"."ikyomm_wallet"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_created_by_user_user_id_fk" FOREIGN KEY ("created_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_updated_by_user_user_id_fk" FOREIGN KEY ("updated_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_deleted_by_user_user_id_fk" FOREIGN KEY ("deleted_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ikyomm_wallet_singletonKey_uidx" ON "ikyomm_wallet" USING btree ("singleton_key");--> statement-breakpoint
CREATE INDEX "ikyomm_wallet_creditMinute_idx" ON "ikyomm_wallet" USING btree ("credit_minute");--> statement-breakpoint
CREATE INDEX "ikyomm_wallet_isDeleted_createdAt_idx" ON "ikyomm_wallet" USING btree ("is_deleted","created_at");--> statement-breakpoint
CREATE INDEX "ikyomm_wallet_isDeleted_updatedAt_idx" ON "ikyomm_wallet" USING btree ("is_deleted","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_wallet_organizationId_uidx" ON "organization_wallet" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "organization_wallet_creditMinute_idx" ON "organization_wallet" USING btree ("credit_minute");--> statement-breakpoint
CREATE INDEX "organization_wallet_isDeleted_createdAt_idx" ON "organization_wallet" USING btree ("is_deleted","created_at");--> statement-breakpoint
CREATE INDEX "organization_wallet_isDeleted_updatedAt_idx" ON "organization_wallet" USING btree ("is_deleted","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "user_wallet_userId_uidx" ON "user_wallet" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_wallet_creditMinute_idx" ON "user_wallet" USING btree ("credit_minute");--> statement-breakpoint
CREATE INDEX "user_wallet_isDeleted_createdAt_idx" ON "user_wallet" USING btree ("is_deleted","created_at");--> statement-breakpoint
CREATE INDEX "user_wallet_isDeleted_updatedAt_idx" ON "user_wallet" USING btree ("is_deleted","updated_at");--> statement-breakpoint
CREATE INDEX "wallet_transactions_type_idx" ON "wallet_transactions" USING btree ("type");--> statement-breakpoint
CREATE INDEX "wallet_transactions_status_idx" ON "wallet_transactions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "wallet_transactions_reference_idx" ON "wallet_transactions" USING btree ("reference");--> statement-breakpoint
CREATE INDEX "wallet_transactions_transactedAt_idx" ON "wallet_transactions" USING btree ("transacted_at");--> statement-breakpoint
CREATE INDEX "wallet_transactions_fromUserWalletId_idx" ON "wallet_transactions" USING btree ("from_user_wallet_id");--> statement-breakpoint
CREATE INDEX "wallet_transactions_fromOrganizationWalletId_idx" ON "wallet_transactions" USING btree ("from_organization_wallet_id");--> statement-breakpoint
CREATE INDEX "wallet_transactions_fromIkyommWalletId_idx" ON "wallet_transactions" USING btree ("from_ikyomm_wallet_id");--> statement-breakpoint
CREATE INDEX "wallet_transactions_toUserWalletId_idx" ON "wallet_transactions" USING btree ("to_user_wallet_id");--> statement-breakpoint
CREATE INDEX "wallet_transactions_toOrganizationWalletId_idx" ON "wallet_transactions" USING btree ("to_organization_wallet_id");--> statement-breakpoint
CREATE INDEX "wallet_transactions_toIkyommWalletId_idx" ON "wallet_transactions" USING btree ("to_ikyomm_wallet_id");--> statement-breakpoint
CREATE INDEX "wallet_transactions_isDeleted_createdAt_idx" ON "wallet_transactions" USING btree ("is_deleted","created_at");--> statement-breakpoint
CREATE INDEX "wallet_transactions_isDeleted_updatedAt_idx" ON "wallet_transactions" USING btree ("is_deleted","updated_at");