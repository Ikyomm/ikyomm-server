CREATE TYPE "public"."access_panel" AS ENUM('ommpods', 'company', 'ikyomm', 'app');--> statement-breakpoint
CREATE TYPE "public"."organization_type" AS ENUM('B2B', 'CORPORATE');--> statement-breakpoint
CREATE TYPE "public"."permission_access_level" AS ENUM('company', 'user', 'all');--> statement-breakpoint
CREATE TYPE "public"."platform_mode" AS ENUM('STANDARD', 'WHITE_LABEL', 'ENTERPRISE');--> statement-breakpoint
CREATE TYPE "public"."door_lock_device_status" AS ENUM('ACTIVE', 'INACTIVE', 'MAINTENANCE', 'DECOMMISSIONED');--> statement-breakpoint
CREATE TYPE "public"."ommpod_status" AS ENUM('ACTIVE', 'INACTIVE', 'MAINTENANCE', 'DECOMMISSIONED');--> statement-breakpoint
CREATE TYPE "public"."ommpod_type" AS ENUM('NEO', 'PRIMO', 'SIGNATURE');--> statement-breakpoint
CREATE TYPE "public"."request_status" AS ENUM('SUBMITTED', 'ACCEPTED', 'REJECTED', 'PAID', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."transaction_status" AS ENUM('PENDING', 'SUCCESS', 'FAILED', 'CANCELLED');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitation" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"email" text NOT NULL,
	"role" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"inviter_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text NOT NULL,
	"panel" "access_panel" DEFAULT 'company' NOT NULL,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by_user" text,
	"updated_by_user" text,
	"deleted_by_user" text,
	"is_deleted" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"logo" text,
	"type" "organization_type" NOT NULL,
	"platform_mode" "platform_mode" DEFAULT 'STANDARD',
	"metadata" text,
	"country" text,
	"state" text,
	"city" text,
	"address" text,
	"email" text,
	"phone_number" text,
	"website_domain" text,
	"is_active" boolean DEFAULT false NOT NULL,
	"credit_minutes" integer DEFAULT 0 NOT NULL,
	"currency_type" text DEFAULT 'INR' NOT NULL,
	"credit_balance" real DEFAULT 0 NOT NULL,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by_user" text,
	"updated_by_user" text,
	"deleted_by_user" text,
	"is_deleted" boolean DEFAULT false NOT NULL,
	CONSTRAINT "organization_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"active_organization_id" text,
	"impersonated_by" text
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"country" text,
	"state" text,
	"city" text,
	"address" text,
	"employee_id" text,
	"employee_email" text,
	"image" text,
	"role" text DEFAULT 'user' NOT NULL,
	"panel" "access_panel" DEFAULT 'ikyomm' NOT NULL,
	"banned" boolean DEFAULT false,
	"ban_reason" text,
	"ban_expires" timestamp,
	"phone_number" text,
	"phone_number_verified" boolean DEFAULT false,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by_user" text,
	"updated_by_user" text,
	"deleted_by_user" text,
	"is_deleted" boolean DEFAULT false NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "rbac_role" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"panel" "access_panel" NOT NULL,
	"organization_id" text,
	"is_system" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rbac_role_permission" (
	"id" text PRIMARY KEY NOT NULL,
	"role_id" text NOT NULL,
	"resource" text NOT NULL,
	"access_level" "permission_access_level" DEFAULT 'all' NOT NULL,
	"actions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "aroma_defuser" (
	"id" text PRIMARY KEY NOT NULL,
	"imei" text NOT NULL,
	"name" text NOT NULL,
	"location" text,
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
CREATE TABLE "door_lock" (
	"id" text PRIMARY KEY NOT NULL,
	"imei" text NOT NULL,
	"name" text NOT NULL,
	"location" text,
	"metadata" text,
	"is_locked" boolean DEFAULT true NOT NULL,
	"status" "door_lock_device_status" DEFAULT 'ACTIVE' NOT NULL,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by_user" text,
	"updated_by_user" text,
	"deleted_by_user" text,
	"is_deleted" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "touchpad" (
	"id" text PRIMARY KEY NOT NULL,
	"imei" text NOT NULL,
	"name" text NOT NULL,
	"location" text,
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
CREATE TABLE "pods" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"type" "ommpod_type" NOT NULL,
	"status" "ommpod_status" NOT NULL,
	"country" text,
	"state" text,
	"city" text,
	"address" text,
	"metadata" text,
	"door_lock_id" text,
	"aroma_defuser_id" text,
	"touchpad_id" text,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by_user" text,
	"updated_by_user" text,
	"deleted_by_user" text,
	"is_deleted" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"status" "request_status" DEFAULT 'SUBMITTED' NOT NULL,
	"credit_minutes" integer NOT NULL,
	"credit_currency" real NOT NULL,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by_user" text,
	"updated_by_user" text,
	"deleted_by_user" text,
	"is_deleted" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"credit_request_id" text,
	"status" "transaction_status" DEFAULT 'PENDING' NOT NULL,
	"credit_minutes" integer NOT NULL,
	"credit_currency" real NOT NULL,
	"payment_details" jsonb,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by_user" text,
	"updated_by_user" text,
	"deleted_by_user" text,
	"is_deleted" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_inviter_id_user_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_created_by_user_user_id_fk" FOREIGN KEY ("created_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_updated_by_user_user_id_fk" FOREIGN KEY ("updated_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_deleted_by_user_user_id_fk" FOREIGN KEY ("deleted_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization" ADD CONSTRAINT "organization_created_by_user_user_id_fk" FOREIGN KEY ("created_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization" ADD CONSTRAINT "organization_updated_by_user_user_id_fk" FOREIGN KEY ("updated_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization" ADD CONSTRAINT "organization_deleted_by_user_user_id_fk" FOREIGN KEY ("deleted_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_active_organization_id_organization_id_fk" FOREIGN KEY ("active_organization_id") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_created_by_user_user_id_fk" FOREIGN KEY ("created_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_updated_by_user_user_id_fk" FOREIGN KEY ("updated_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_deleted_by_user_user_id_fk" FOREIGN KEY ("deleted_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rbac_role" ADD CONSTRAINT "rbac_role_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rbac_role_permission" ADD CONSTRAINT "rbac_role_permission_role_id_rbac_role_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."rbac_role"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aroma_defuser" ADD CONSTRAINT "aroma_defuser_created_by_user_user_id_fk" FOREIGN KEY ("created_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aroma_defuser" ADD CONSTRAINT "aroma_defuser_updated_by_user_user_id_fk" FOREIGN KEY ("updated_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aroma_defuser" ADD CONSTRAINT "aroma_defuser_deleted_by_user_user_id_fk" FOREIGN KEY ("deleted_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "door_lock" ADD CONSTRAINT "door_lock_created_by_user_user_id_fk" FOREIGN KEY ("created_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "door_lock" ADD CONSTRAINT "door_lock_updated_by_user_user_id_fk" FOREIGN KEY ("updated_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "door_lock" ADD CONSTRAINT "door_lock_deleted_by_user_user_id_fk" FOREIGN KEY ("deleted_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "touchpad" ADD CONSTRAINT "touchpad_created_by_user_user_id_fk" FOREIGN KEY ("created_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "touchpad" ADD CONSTRAINT "touchpad_updated_by_user_user_id_fk" FOREIGN KEY ("updated_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "touchpad" ADD CONSTRAINT "touchpad_deleted_by_user_user_id_fk" FOREIGN KEY ("deleted_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pods" ADD CONSTRAINT "pods_door_lock_id_door_lock_id_fk" FOREIGN KEY ("door_lock_id") REFERENCES "public"."door_lock"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pods" ADD CONSTRAINT "pods_aroma_defuser_id_aroma_defuser_id_fk" FOREIGN KEY ("aroma_defuser_id") REFERENCES "public"."aroma_defuser"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pods" ADD CONSTRAINT "pods_touchpad_id_touchpad_id_fk" FOREIGN KEY ("touchpad_id") REFERENCES "public"."touchpad"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pods" ADD CONSTRAINT "pods_created_by_user_user_id_fk" FOREIGN KEY ("created_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pods" ADD CONSTRAINT "pods_updated_by_user_user_id_fk" FOREIGN KEY ("updated_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pods" ADD CONSTRAINT "pods_deleted_by_user_user_id_fk" FOREIGN KEY ("deleted_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_requests" ADD CONSTRAINT "credit_requests_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_requests" ADD CONSTRAINT "credit_requests_created_by_user_user_id_fk" FOREIGN KEY ("created_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_requests" ADD CONSTRAINT "credit_requests_updated_by_user_user_id_fk" FOREIGN KEY ("updated_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_requests" ADD CONSTRAINT "credit_requests_deleted_by_user_user_id_fk" FOREIGN KEY ("deleted_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_credit_request_id_credit_requests_id_fk" FOREIGN KEY ("credit_request_id") REFERENCES "public"."credit_requests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_created_by_user_user_id_fk" FOREIGN KEY ("created_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_updated_by_user_user_id_fk" FOREIGN KEY ("updated_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_deleted_by_user_user_id_fk" FOREIGN KEY ("deleted_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "invitation_organizationId_idx" ON "invitation" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "invitation_email_idx" ON "invitation" USING btree ("email");--> statement-breakpoint
CREATE INDEX "member_organizationId_idx" ON "member" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "member_userId_idx" ON "member" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "member_panel_idx" ON "member" USING btree ("panel");--> statement-breakpoint
CREATE INDEX "member_organizationId_role_idx" ON "member" USING btree ("organization_id","role");--> statement-breakpoint
CREATE INDEX "member_organizationId_isDeleted_userId_idx" ON "member" USING btree ("organization_id","is_deleted","user_id");--> statement-breakpoint
CREATE INDEX "member_organizationId_isDeleted_role_idx" ON "member" USING btree ("organization_id","is_deleted","role");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_slug_uidx" ON "organization" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "organization_isDeleted_createdAt_idx" ON "organization" USING btree ("is_deleted","created_at");--> statement-breakpoint
CREATE INDEX "organization_isDeleted_updatedAt_idx" ON "organization" USING btree ("is_deleted","updated_at");--> statement-breakpoint
CREATE INDEX "organization_isDeleted_name_idx" ON "organization" USING btree ("is_deleted","name");--> statement-breakpoint
CREATE INDEX "organization_isDeleted_type_idx" ON "organization" USING btree ("is_deleted","type");--> statement-breakpoint
CREATE INDEX "organization_isDeleted_isActive_idx" ON "organization" USING btree ("is_deleted","is_active");--> statement-breakpoint
CREATE INDEX "organization_email_idx" ON "organization" USING btree ("email");--> statement-breakpoint
CREATE INDEX "organization_phoneNumber_idx" ON "organization" USING btree ("phone_number");--> statement-breakpoint
CREATE INDEX "organization_websiteDomain_idx" ON "organization" USING btree ("website_domain");--> statement-breakpoint
CREATE INDEX "organization_country_idx" ON "organization" USING btree ("country");--> statement-breakpoint
CREATE INDEX "organization_state_idx" ON "organization" USING btree ("state");--> statement-breakpoint
CREATE INDEX "organization_city_idx" ON "organization" USING btree ("city");--> statement-breakpoint
CREATE UNIQUE INDEX "session_token_uidx" ON "session" USING btree ("token");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_activeOrganizationId_idx" ON "session" USING btree ("active_organization_id");--> statement-breakpoint
CREATE INDEX "session_expiresAt_idx" ON "session" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "user_name_idx" ON "user" USING btree ("name");--> statement-breakpoint
CREATE INDEX "user_role_idx" ON "user" USING btree ("role");--> statement-breakpoint
CREATE INDEX "user_panel_idx" ON "user" USING btree ("panel");--> statement-breakpoint
CREATE INDEX "user_emailVerified_idx" ON "user" USING btree ("email_verified");--> statement-breakpoint
CREATE INDEX "user_banned_idx" ON "user" USING btree ("banned");--> statement-breakpoint
CREATE INDEX "user_phoneNumberVerified_idx" ON "user" USING btree ("phone_number_verified");--> statement-breakpoint
CREATE INDEX "user_country_idx" ON "user" USING btree ("country");--> statement-breakpoint
CREATE INDEX "user_state_idx" ON "user" USING btree ("state");--> statement-breakpoint
CREATE INDEX "user_city_idx" ON "user" USING btree ("city");--> statement-breakpoint
CREATE INDEX "user_employeeEmail_idx" ON "user" USING btree ("employee_email");--> statement-breakpoint
CREATE INDEX "rbac_role_panel_idx" ON "rbac_role" USING btree ("panel");--> statement-breakpoint
CREATE INDEX "rbac_role_org_idx" ON "rbac_role" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "rbac_role_slug_idx" ON "rbac_role" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "rbac_role_panel_slug_idx" ON "rbac_role" USING btree ("panel","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "rbac_role_permission_role_resource_uidx" ON "rbac_role_permission" USING btree ("role_id","resource");--> statement-breakpoint
CREATE INDEX "rbac_role_permission_resource_idx" ON "rbac_role_permission" USING btree ("resource");--> statement-breakpoint
CREATE UNIQUE INDEX "aroma_defuser_imei_uidx" ON "aroma_defuser" USING btree ("imei");--> statement-breakpoint
CREATE INDEX "aroma_defuser_imei_idx" ON "aroma_defuser" USING btree ("imei");--> statement-breakpoint
CREATE INDEX "aroma_defuser_name_idx" ON "aroma_defuser" USING btree ("name");--> statement-breakpoint
CREATE INDEX "aroma_defuser_location_idx" ON "aroma_defuser" USING btree ("location");--> statement-breakpoint
CREATE INDEX "aroma_defuser_isDeleted_createdAt_idx" ON "aroma_defuser" USING btree ("is_deleted","created_at");--> statement-breakpoint
CREATE INDEX "aroma_defuser_isDeleted_updatedAt_idx" ON "aroma_defuser" USING btree ("is_deleted","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "door_lock_imei_uidx" ON "door_lock" USING btree ("imei");--> statement-breakpoint
CREATE INDEX "door_lock_imei_idx" ON "door_lock" USING btree ("imei");--> statement-breakpoint
CREATE INDEX "door_lock_name_idx" ON "door_lock" USING btree ("name");--> statement-breakpoint
CREATE INDEX "door_lock_location_idx" ON "door_lock" USING btree ("location");--> statement-breakpoint
CREATE INDEX "door_lock_isLocked_idx" ON "door_lock" USING btree ("is_locked");--> statement-breakpoint
CREATE INDEX "door_lock_status_idx" ON "door_lock" USING btree ("status");--> statement-breakpoint
CREATE INDEX "door_lock_isDeleted_createdAt_idx" ON "door_lock" USING btree ("is_deleted","created_at");--> statement-breakpoint
CREATE INDEX "door_lock_isDeleted_updatedAt_idx" ON "door_lock" USING btree ("is_deleted","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "touchpad_imei_uidx" ON "touchpad" USING btree ("imei");--> statement-breakpoint
CREATE INDEX "touchpad_imei_idx" ON "touchpad" USING btree ("imei");--> statement-breakpoint
CREATE INDEX "touchpad_name_idx" ON "touchpad" USING btree ("name");--> statement-breakpoint
CREATE INDEX "touchpad_location_idx" ON "touchpad" USING btree ("location");--> statement-breakpoint
CREATE INDEX "touchpad_isDeleted_createdAt_idx" ON "touchpad" USING btree ("is_deleted","created_at");--> statement-breakpoint
CREATE INDEX "touchpad_isDeleted_updatedAt_idx" ON "touchpad" USING btree ("is_deleted","updated_at");--> statement-breakpoint
CREATE INDEX "pods_name_idx" ON "pods" USING btree ("name");--> statement-breakpoint
CREATE INDEX "pods_type_idx" ON "pods" USING btree ("type");--> statement-breakpoint
CREATE INDEX "pods_status_idx" ON "pods" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "pods_door_lock_id_uidx" ON "pods" USING btree ("door_lock_id");--> statement-breakpoint
CREATE UNIQUE INDEX "pods_aroma_defuser_id_uidx" ON "pods" USING btree ("aroma_defuser_id");--> statement-breakpoint
CREATE UNIQUE INDEX "pods_touchpad_id_uidx" ON "pods" USING btree ("touchpad_id");--> statement-breakpoint
CREATE INDEX "pods_country_idx" ON "pods" USING btree ("country");--> statement-breakpoint
CREATE INDEX "pods_state_idx" ON "pods" USING btree ("state");--> statement-breakpoint
CREATE INDEX "pods_city_idx" ON "pods" USING btree ("city");--> statement-breakpoint
CREATE INDEX "pods_isDeleted_createdAt_idx" ON "pods" USING btree ("is_deleted","created_at");--> statement-breakpoint
CREATE INDEX "pods_isDeleted_updatedAt_idx" ON "pods" USING btree ("is_deleted","updated_at");--> statement-breakpoint
CREATE INDEX "credit_requests_org_id_idx" ON "credit_requests" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "credit_requests_status_idx" ON "credit_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "credit_requests_is_deleted_idx" ON "credit_requests" USING btree ("is_deleted");--> statement-breakpoint
CREATE INDEX "credit_transactions_org_id_idx" ON "credit_transactions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "credit_transactions_credit_request_id_idx" ON "credit_transactions" USING btree ("credit_request_id");--> statement-breakpoint
CREATE INDEX "credit_transactions_status_idx" ON "credit_transactions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "credit_transactions_is_deleted_idx" ON "credit_transactions" USING btree ("is_deleted");--> statement-breakpoint
CREATE INDEX "credit_transactions_isDeleted_createdAt_idx" ON "credit_transactions" USING btree ("is_deleted","created_at");