CREATE TYPE "public"."treasure_address_type" AS ENUM('BILLING', 'SHIPPING');--> statement-breakpoint
CREATE TYPE "public"."treasure_brand_status" AS ENUM('ACTIVE', 'INACTIVE');--> statement-breakpoint
CREATE TYPE "public"."treasure_launch_phase" AS ENUM('PHASE_1', 'PHASE_2', 'FUTURE');--> statement-breakpoint
CREATE TYPE "public"."treasure_category_status" AS ENUM('ACTIVE', 'INACTIVE');--> statement-breakpoint
CREATE TYPE "public"."treasure_warehouse_status" AS ENUM('ACTIVE', 'INACTIVE');--> statement-breakpoint
CREATE TYPE "public"."treasure_order_status" AS ENUM('PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED');--> statement-breakpoint
CREATE TYPE "public"."treasure_payment_method" AS ENUM('CARD', 'UPI', 'NET_BANKING', 'WALLET', 'CASH_ON_DELIVERY', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."treasure_payment_status" AS ENUM('PENDING', 'PAID', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED');--> statement-breakpoint
CREATE TYPE "public"."treasure_product_status" AS ENUM('PLANNED', 'DRAFT', 'ACTIVE', 'INACTIVE', 'OUT_OF_STOCK');--> statement-breakpoint
CREATE TYPE "public"."treasure_product_type" AS ENUM('SIMPLE', 'VARIABLE', 'BUNDLE', 'SUBSCRIPTION');--> statement-breakpoint
CREATE TYPE "public"."treasure_stock_status" AS ENUM('IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK');--> statement-breakpoint
CREATE TYPE "public"."treasure_variant_status" AS ENUM('PLANNED', 'ACTIVE', 'INACTIVE');--> statement-breakpoint
CREATE TYPE "public"."treasure_review_status" AS ENUM('PENDING', 'PUBLISHED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."treasure_billing_interval" AS ENUM('DAY', 'WEEK', 'MONTH', 'YEAR');--> statement-breakpoint
CREATE TYPE "public"."treasure_subscription_status" AS ENUM('ACTIVE', 'PAUSED', 'CANCELLED', 'EXPIRED');--> statement-breakpoint
CREATE TABLE "treasure_addresses" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"label" text NOT NULL,
	"type" "treasure_address_type" NOT NULL,
	"recipient_name" text NOT NULL,
	"phone_number" text,
	"address_line_1" text NOT NULL,
	"address_line_2" text,
	"city" text NOT NULL,
	"state" text NOT NULL,
	"country" text DEFAULT 'India' NOT NULL,
	"pincode" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by_user" text,
	"updated_by_user" text,
	"deleted_by_user" text,
	"is_deleted" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "treasure_brands" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"logo" text,
	"positioning" text,
	"tagline" text,
	"core_categories" text[],
	"future_expansion" text[],
	"launch_phase" "treasure_launch_phase" DEFAULT 'PHASE_1' NOT NULL,
	"status" "treasure_brand_status" DEFAULT 'ACTIVE' NOT NULL,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by_user" text,
	"updated_by_user" text,
	"deleted_by_user" text,
	"is_deleted" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "treasure_categories" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"status" "treasure_category_status" DEFAULT 'ACTIVE' NOT NULL,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by_user" text,
	"updated_by_user" text,
	"deleted_by_user" text,
	"is_deleted" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "treasure_subcategories" (
	"id" text PRIMARY KEY NOT NULL,
	"category_id" text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"status" "treasure_category_status" DEFAULT 'ACTIVE' NOT NULL,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by_user" text,
	"updated_by_user" text,
	"deleted_by_user" text,
	"is_deleted" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "treasure_inventory" (
	"id" text PRIMARY KEY NOT NULL,
	"variant_id" text NOT NULL,
	"warehouse_id" text NOT NULL,
	"quantity_available" integer DEFAULT 0 NOT NULL,
	"reserved_quantity" integer DEFAULT 0 NOT NULL,
	"low_stock_threshold" integer DEFAULT 0 NOT NULL,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by_user" text,
	"updated_by_user" text,
	"deleted_by_user" text,
	"is_deleted" boolean DEFAULT false NOT NULL,
	CONSTRAINT "treasure_inventory_quantity_available_check" CHECK ("treasure_inventory"."quantity_available" >= 0),
	CONSTRAINT "treasure_inventory_reserved_quantity_check" CHECK ("treasure_inventory"."reserved_quantity" >= 0),
	CONSTRAINT "treasure_inventory_low_stock_threshold_check" CHECK ("treasure_inventory"."low_stock_threshold" >= 0),
	CONSTRAINT "treasure_inventory_reservation_check" CHECK ("treasure_inventory"."reserved_quantity" <= "treasure_inventory"."quantity_available")
);
--> statement-breakpoint
CREATE TABLE "treasure_warehouses" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"address_line_1" text NOT NULL,
	"address_line_2" text,
	"city" text NOT NULL,
	"state" text NOT NULL,
	"country" text DEFAULT 'India' NOT NULL,
	"pincode" text NOT NULL,
	"status" "treasure_warehouse_status" DEFAULT 'ACTIVE' NOT NULL,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by_user" text,
	"updated_by_user" text,
	"deleted_by_user" text,
	"is_deleted" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "treasure_order_items" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"variant_id" text NOT NULL,
	"sku" text NOT NULL,
	"product_name" text NOT NULL,
	"variant_name" text NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price" real NOT NULL,
	"total" real NOT NULL,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by_user" text,
	"updated_by_user" text,
	"deleted_by_user" text,
	"is_deleted" boolean DEFAULT false NOT NULL,
	CONSTRAINT "treasure_order_items_quantity_check" CHECK ("treasure_order_items"."quantity" > 0),
	CONSTRAINT "treasure_order_items_unit_price_check" CHECK ("treasure_order_items"."unit_price" >= 0),
	CONSTRAINT "treasure_order_items_total_check" CHECK ("treasure_order_items"."total" >= 0)
);
--> statement-breakpoint
CREATE TABLE "treasure_orders" (
	"id" text PRIMARY KEY NOT NULL,
	"order_number" text NOT NULL,
	"user_id" text NOT NULL,
	"billing_address_id" text,
	"shipping_address_id" text,
	"billing_address_snapshot" jsonb NOT NULL,
	"shipping_address_snapshot" jsonb NOT NULL,
	"status" "treasure_order_status" DEFAULT 'PENDING' NOT NULL,
	"subtotal_amount" real DEFAULT 0 NOT NULL,
	"discount_amount" real DEFAULT 0 NOT NULL,
	"shipping_amount" real DEFAULT 0 NOT NULL,
	"tax_amount" real DEFAULT 0 NOT NULL,
	"total_amount" real NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"notes" text,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by_user" text,
	"updated_by_user" text,
	"deleted_by_user" text,
	"is_deleted" boolean DEFAULT false NOT NULL,
	CONSTRAINT "treasure_orders_subtotal_amount_check" CHECK ("treasure_orders"."subtotal_amount" >= 0),
	CONSTRAINT "treasure_orders_discount_amount_check" CHECK ("treasure_orders"."discount_amount" >= 0),
	CONSTRAINT "treasure_orders_shipping_amount_check" CHECK ("treasure_orders"."shipping_amount" >= 0),
	CONSTRAINT "treasure_orders_tax_amount_check" CHECK ("treasure_orders"."tax_amount" >= 0),
	CONSTRAINT "treasure_orders_total_amount_check" CHECK ("treasure_orders"."total_amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "treasure_payments" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"external_reference" text,
	"amount" real NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"status" "treasure_payment_status" DEFAULT 'PENDING' NOT NULL,
	"method" "treasure_payment_method" NOT NULL,
	"paid_at" timestamp,
	"failure_reason" text,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by_user" text,
	"updated_by_user" text,
	"deleted_by_user" text,
	"is_deleted" boolean DEFAULT false NOT NULL,
	CONSTRAINT "treasure_payments_amount_check" CHECK ("treasure_payments"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "treasure_product_images" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"url" text NOT NULL,
	"alt_text" text,
	"is_primary" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by_user" text,
	"updated_by_user" text,
	"deleted_by_user" text,
	"is_deleted" boolean DEFAULT false NOT NULL,
	CONSTRAINT "treasure_product_images_sort_order_check" CHECK ("treasure_product_images"."sort_order" >= 0)
);
--> statement-breakpoint
CREATE TABLE "treasure_product_variants" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"sku" text NOT NULL,
	"name" text NOT NULL,
	"size" text,
	"weight_grams" real,
	"estimated_cogs" real,
	"price" real NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"gross_margin_target" real,
	"vendor" text,
	"minimum_order_quantity" integer,
	"packaging" text,
	"stock_status" "treasure_stock_status" DEFAULT 'OUT_OF_STOCK' NOT NULL,
	"status" "treasure_variant_status" DEFAULT 'PLANNED' NOT NULL,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by_user" text,
	"updated_by_user" text,
	"deleted_by_user" text,
	"is_deleted" boolean DEFAULT false NOT NULL,
	CONSTRAINT "treasure_product_variants_price_check" CHECK ("treasure_product_variants"."price" >= 0),
	CONSTRAINT "treasure_product_variants_estimated_cogs_check" CHECK ("treasure_product_variants"."estimated_cogs" is null or "treasure_product_variants"."estimated_cogs" >= 0),
	CONSTRAINT "treasure_product_variants_margin_check" CHECK ("treasure_product_variants"."gross_margin_target" is null or ("treasure_product_variants"."gross_margin_target" >= 0 and "treasure_product_variants"."gross_margin_target" <= 100)),
	CONSTRAINT "treasure_product_variants_moq_check" CHECK ("treasure_product_variants"."minimum_order_quantity" is null or "treasure_product_variants"."minimum_order_quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "treasure_products" (
	"id" text PRIMARY KEY NOT NULL,
	"brand_id" text NOT NULL,
	"category_id" text NOT NULL,
	"subcategory_id" text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"short_description" text,
	"description" text,
	"collection" text,
	"material_or_ingredients" text,
	"country_of_origin" text,
	"target_customer" text,
	"product_type" "treasure_product_type" DEFAULT 'VARIABLE' NOT NULL,
	"status" "treasure_product_status" DEFAULT 'DRAFT' NOT NULL,
	"launch_phase" "treasure_launch_phase" DEFAULT 'PHASE_1' NOT NULL,
	"is_hero_product" boolean DEFAULT false NOT NULL,
	"is_private_label" boolean DEFAULT false NOT NULL,
	"is_subscription_eligible" boolean DEFAULT false NOT NULL,
	"is_bundle_eligible" boolean DEFAULT false NOT NULL,
	"is_corporate_gift_eligible" boolean DEFAULT false NOT NULL,
	"is_ommpods_compatible" boolean DEFAULT false NOT NULL,
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
CREATE TABLE "treasure_variant_attributes" (
	"id" text PRIMARY KEY NOT NULL,
	"variant_id" text NOT NULL,
	"attribute_name" text NOT NULL,
	"attribute_value" text NOT NULL,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by_user" text,
	"updated_by_user" text,
	"deleted_by_user" text,
	"is_deleted" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "treasure_reviews" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"user_id" text NOT NULL,
	"rating" integer NOT NULL,
	"title" text,
	"review" text,
	"status" "treasure_review_status" DEFAULT 'PENDING' NOT NULL,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by_user" text,
	"updated_by_user" text,
	"deleted_by_user" text,
	"is_deleted" boolean DEFAULT false NOT NULL,
	CONSTRAINT "treasure_reviews_rating_check" CHECK ("treasure_reviews"."rating" between 1 and 5)
);
--> statement-breakpoint
CREATE TABLE "treasure_subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"variant_id" text NOT NULL,
	"billing_address_id" text,
	"status" "treasure_subscription_status" DEFAULT 'ACTIVE' NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_price" real NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"billing_interval" "treasure_billing_interval" DEFAULT 'MONTH' NOT NULL,
	"billing_interval_count" integer DEFAULT 1 NOT NULL,
	"start_date" timestamp DEFAULT now() NOT NULL,
	"end_date" timestamp,
	"next_billing_date" timestamp NOT NULL,
	"paused_at" timestamp,
	"cancelled_at" timestamp,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by_user" text,
	"updated_by_user" text,
	"deleted_by_user" text,
	"is_deleted" boolean DEFAULT false NOT NULL,
	CONSTRAINT "treasure_subscriptions_quantity_check" CHECK ("treasure_subscriptions"."quantity" > 0),
	CONSTRAINT "treasure_subscriptions_unit_price_check" CHECK ("treasure_subscriptions"."unit_price" >= 0),
	CONSTRAINT "treasure_subscriptions_interval_count_check" CHECK ("treasure_subscriptions"."billing_interval_count" > 0),
	CONSTRAINT "treasure_subscriptions_date_range_check" CHECK ("treasure_subscriptions"."end_date" is null or "treasure_subscriptions"."end_date" >= "treasure_subscriptions"."start_date")
);
--> statement-breakpoint
ALTER TABLE "treasure_addresses" ADD CONSTRAINT "treasure_addresses_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasure_addresses" ADD CONSTRAINT "treasure_addresses_created_by_user_user_id_fk" FOREIGN KEY ("created_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasure_addresses" ADD CONSTRAINT "treasure_addresses_updated_by_user_user_id_fk" FOREIGN KEY ("updated_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasure_addresses" ADD CONSTRAINT "treasure_addresses_deleted_by_user_user_id_fk" FOREIGN KEY ("deleted_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasure_brands" ADD CONSTRAINT "treasure_brands_created_by_user_user_id_fk" FOREIGN KEY ("created_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasure_brands" ADD CONSTRAINT "treasure_brands_updated_by_user_user_id_fk" FOREIGN KEY ("updated_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasure_brands" ADD CONSTRAINT "treasure_brands_deleted_by_user_user_id_fk" FOREIGN KEY ("deleted_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasure_categories" ADD CONSTRAINT "treasure_categories_created_by_user_user_id_fk" FOREIGN KEY ("created_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasure_categories" ADD CONSTRAINT "treasure_categories_updated_by_user_user_id_fk" FOREIGN KEY ("updated_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasure_categories" ADD CONSTRAINT "treasure_categories_deleted_by_user_user_id_fk" FOREIGN KEY ("deleted_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasure_subcategories" ADD CONSTRAINT "treasure_subcategories_category_id_treasure_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."treasure_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasure_subcategories" ADD CONSTRAINT "treasure_subcategories_created_by_user_user_id_fk" FOREIGN KEY ("created_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasure_subcategories" ADD CONSTRAINT "treasure_subcategories_updated_by_user_user_id_fk" FOREIGN KEY ("updated_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasure_subcategories" ADD CONSTRAINT "treasure_subcategories_deleted_by_user_user_id_fk" FOREIGN KEY ("deleted_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasure_inventory" ADD CONSTRAINT "treasure_inventory_variant_id_treasure_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."treasure_product_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasure_inventory" ADD CONSTRAINT "treasure_inventory_warehouse_id_treasure_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."treasure_warehouses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasure_inventory" ADD CONSTRAINT "treasure_inventory_created_by_user_user_id_fk" FOREIGN KEY ("created_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasure_inventory" ADD CONSTRAINT "treasure_inventory_updated_by_user_user_id_fk" FOREIGN KEY ("updated_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasure_inventory" ADD CONSTRAINT "treasure_inventory_deleted_by_user_user_id_fk" FOREIGN KEY ("deleted_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasure_warehouses" ADD CONSTRAINT "treasure_warehouses_created_by_user_user_id_fk" FOREIGN KEY ("created_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasure_warehouses" ADD CONSTRAINT "treasure_warehouses_updated_by_user_user_id_fk" FOREIGN KEY ("updated_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasure_warehouses" ADD CONSTRAINT "treasure_warehouses_deleted_by_user_user_id_fk" FOREIGN KEY ("deleted_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasure_order_items" ADD CONSTRAINT "treasure_order_items_order_id_treasure_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."treasure_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasure_order_items" ADD CONSTRAINT "treasure_order_items_variant_id_treasure_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."treasure_product_variants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasure_order_items" ADD CONSTRAINT "treasure_order_items_created_by_user_user_id_fk" FOREIGN KEY ("created_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasure_order_items" ADD CONSTRAINT "treasure_order_items_updated_by_user_user_id_fk" FOREIGN KEY ("updated_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasure_order_items" ADD CONSTRAINT "treasure_order_items_deleted_by_user_user_id_fk" FOREIGN KEY ("deleted_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasure_orders" ADD CONSTRAINT "treasure_orders_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasure_orders" ADD CONSTRAINT "treasure_orders_billing_address_id_treasure_addresses_id_fk" FOREIGN KEY ("billing_address_id") REFERENCES "public"."treasure_addresses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasure_orders" ADD CONSTRAINT "treasure_orders_shipping_address_id_treasure_addresses_id_fk" FOREIGN KEY ("shipping_address_id") REFERENCES "public"."treasure_addresses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasure_orders" ADD CONSTRAINT "treasure_orders_created_by_user_user_id_fk" FOREIGN KEY ("created_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasure_orders" ADD CONSTRAINT "treasure_orders_updated_by_user_user_id_fk" FOREIGN KEY ("updated_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasure_orders" ADD CONSTRAINT "treasure_orders_deleted_by_user_user_id_fk" FOREIGN KEY ("deleted_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasure_payments" ADD CONSTRAINT "treasure_payments_order_id_treasure_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."treasure_orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasure_payments" ADD CONSTRAINT "treasure_payments_created_by_user_user_id_fk" FOREIGN KEY ("created_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasure_payments" ADD CONSTRAINT "treasure_payments_updated_by_user_user_id_fk" FOREIGN KEY ("updated_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasure_payments" ADD CONSTRAINT "treasure_payments_deleted_by_user_user_id_fk" FOREIGN KEY ("deleted_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasure_product_images" ADD CONSTRAINT "treasure_product_images_product_id_treasure_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."treasure_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasure_product_images" ADD CONSTRAINT "treasure_product_images_created_by_user_user_id_fk" FOREIGN KEY ("created_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasure_product_images" ADD CONSTRAINT "treasure_product_images_updated_by_user_user_id_fk" FOREIGN KEY ("updated_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasure_product_images" ADD CONSTRAINT "treasure_product_images_deleted_by_user_user_id_fk" FOREIGN KEY ("deleted_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasure_product_variants" ADD CONSTRAINT "treasure_product_variants_product_id_treasure_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."treasure_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasure_product_variants" ADD CONSTRAINT "treasure_product_variants_created_by_user_user_id_fk" FOREIGN KEY ("created_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasure_product_variants" ADD CONSTRAINT "treasure_product_variants_updated_by_user_user_id_fk" FOREIGN KEY ("updated_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasure_product_variants" ADD CONSTRAINT "treasure_product_variants_deleted_by_user_user_id_fk" FOREIGN KEY ("deleted_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasure_products" ADD CONSTRAINT "treasure_products_brand_id_treasure_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."treasure_brands"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasure_products" ADD CONSTRAINT "treasure_products_category_id_treasure_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."treasure_categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasure_products" ADD CONSTRAINT "treasure_products_subcategory_id_treasure_subcategories_id_fk" FOREIGN KEY ("subcategory_id") REFERENCES "public"."treasure_subcategories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasure_products" ADD CONSTRAINT "treasure_products_created_by_user_user_id_fk" FOREIGN KEY ("created_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasure_products" ADD CONSTRAINT "treasure_products_updated_by_user_user_id_fk" FOREIGN KEY ("updated_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasure_products" ADD CONSTRAINT "treasure_products_deleted_by_user_user_id_fk" FOREIGN KEY ("deleted_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "treasure_subcategories_category_id_id_uidx" ON "treasure_subcategories" USING btree ("category_id","id");--> statement-breakpoint
ALTER TABLE "treasure_products" ADD CONSTRAINT "treasure_products_category_subcategory_fk" FOREIGN KEY ("category_id","subcategory_id") REFERENCES "public"."treasure_subcategories"("category_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasure_variant_attributes" ADD CONSTRAINT "treasure_variant_attributes_variant_id_treasure_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."treasure_product_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasure_variant_attributes" ADD CONSTRAINT "treasure_variant_attributes_created_by_user_user_id_fk" FOREIGN KEY ("created_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasure_variant_attributes" ADD CONSTRAINT "treasure_variant_attributes_updated_by_user_user_id_fk" FOREIGN KEY ("updated_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasure_variant_attributes" ADD CONSTRAINT "treasure_variant_attributes_deleted_by_user_user_id_fk" FOREIGN KEY ("deleted_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasure_reviews" ADD CONSTRAINT "treasure_reviews_product_id_treasure_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."treasure_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasure_reviews" ADD CONSTRAINT "treasure_reviews_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasure_reviews" ADD CONSTRAINT "treasure_reviews_created_by_user_user_id_fk" FOREIGN KEY ("created_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasure_reviews" ADD CONSTRAINT "treasure_reviews_updated_by_user_user_id_fk" FOREIGN KEY ("updated_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasure_reviews" ADD CONSTRAINT "treasure_reviews_deleted_by_user_user_id_fk" FOREIGN KEY ("deleted_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasure_subscriptions" ADD CONSTRAINT "treasure_subscriptions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasure_subscriptions" ADD CONSTRAINT "treasure_subscriptions_variant_id_treasure_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."treasure_product_variants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasure_subscriptions" ADD CONSTRAINT "treasure_subscriptions_billing_address_id_treasure_addresses_id_fk" FOREIGN KEY ("billing_address_id") REFERENCES "public"."treasure_addresses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasure_subscriptions" ADD CONSTRAINT "treasure_subscriptions_created_by_user_user_id_fk" FOREIGN KEY ("created_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasure_subscriptions" ADD CONSTRAINT "treasure_subscriptions_updated_by_user_user_id_fk" FOREIGN KEY ("updated_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasure_subscriptions" ADD CONSTRAINT "treasure_subscriptions_deleted_by_user_user_id_fk" FOREIGN KEY ("deleted_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "treasure_addresses_user_id_idx" ON "treasure_addresses" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "treasure_addresses_user_type_idx" ON "treasure_addresses" USING btree ("user_id","type");--> statement-breakpoint
CREATE UNIQUE INDEX "treasure_brands_name_uidx" ON "treasure_brands" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "treasure_brands_slug_uidx" ON "treasure_brands" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "treasure_brands_status_idx" ON "treasure_brands" USING btree ("status");--> statement-breakpoint
CREATE INDEX "treasure_brands_launch_phase_idx" ON "treasure_brands" USING btree ("launch_phase");--> statement-breakpoint
CREATE UNIQUE INDEX "treasure_categories_slug_uidx" ON "treasure_categories" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "treasure_categories_status_idx" ON "treasure_categories" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "treasure_subcategories_category_slug_uidx" ON "treasure_subcategories" USING btree ("category_id","slug");--> statement-breakpoint
CREATE INDEX "treasure_subcategories_category_id_idx" ON "treasure_subcategories" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "treasure_subcategories_status_idx" ON "treasure_subcategories" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "treasure_inventory_variant_warehouse_uidx" ON "treasure_inventory" USING btree ("variant_id","warehouse_id");--> statement-breakpoint
CREATE INDEX "treasure_inventory_warehouse_id_idx" ON "treasure_inventory" USING btree ("warehouse_id");--> statement-breakpoint
CREATE UNIQUE INDEX "treasure_warehouses_code_uidx" ON "treasure_warehouses" USING btree ("code");--> statement-breakpoint
CREATE INDEX "treasure_warehouses_status_idx" ON "treasure_warehouses" USING btree ("status");--> statement-breakpoint
CREATE INDEX "treasure_order_items_order_id_idx" ON "treasure_order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "treasure_order_items_variant_id_idx" ON "treasure_order_items" USING btree ("variant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "treasure_orders_order_number_uidx" ON "treasure_orders" USING btree ("order_number");--> statement-breakpoint
CREATE INDEX "treasure_orders_user_id_idx" ON "treasure_orders" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "treasure_orders_status_idx" ON "treasure_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "treasure_orders_created_at_idx" ON "treasure_orders" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "treasure_payments_order_id_idx" ON "treasure_payments" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "treasure_payments_status_idx" ON "treasure_payments" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "treasure_payments_external_reference_uidx" ON "treasure_payments" USING btree ("external_reference");--> statement-breakpoint
CREATE UNIQUE INDEX "treasure_product_images_product_url_uidx" ON "treasure_product_images" USING btree ("product_id","url");--> statement-breakpoint
CREATE INDEX "treasure_product_images_product_sort_idx" ON "treasure_product_images" USING btree ("product_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "treasure_product_variants_sku_uidx" ON "treasure_product_variants" USING btree ("sku");--> statement-breakpoint
CREATE INDEX "treasure_product_variants_product_id_idx" ON "treasure_product_variants" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "treasure_product_variants_status_idx" ON "treasure_product_variants" USING btree ("status");--> statement-breakpoint
CREATE INDEX "treasure_product_variants_stock_status_idx" ON "treasure_product_variants" USING btree ("stock_status");--> statement-breakpoint
CREATE UNIQUE INDEX "treasure_products_brand_slug_uidx" ON "treasure_products" USING btree ("brand_id","slug");--> statement-breakpoint
CREATE INDEX "treasure_products_brand_id_idx" ON "treasure_products" USING btree ("brand_id");--> statement-breakpoint
CREATE INDEX "treasure_products_category_id_idx" ON "treasure_products" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "treasure_products_subcategory_id_idx" ON "treasure_products" USING btree ("subcategory_id");--> statement-breakpoint
CREATE INDEX "treasure_products_status_idx" ON "treasure_products" USING btree ("status");--> statement-breakpoint
CREATE INDEX "treasure_products_product_type_idx" ON "treasure_products" USING btree ("product_type");--> statement-breakpoint
CREATE UNIQUE INDEX "treasure_variant_attributes_name_uidx" ON "treasure_variant_attributes" USING btree ("variant_id","attribute_name");--> statement-breakpoint
CREATE INDEX "treasure_variant_attributes_variant_id_idx" ON "treasure_variant_attributes" USING btree ("variant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "treasure_reviews_product_user_uidx" ON "treasure_reviews" USING btree ("product_id","user_id");--> statement-breakpoint
CREATE INDEX "treasure_reviews_product_status_idx" ON "treasure_reviews" USING btree ("product_id","status");--> statement-breakpoint
CREATE INDEX "treasure_reviews_user_id_idx" ON "treasure_reviews" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "treasure_subscriptions_user_id_idx" ON "treasure_subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "treasure_subscriptions_variant_id_idx" ON "treasure_subscriptions" USING btree ("variant_id");--> statement-breakpoint
CREATE INDEX "treasure_subscriptions_status_next_billing_idx" ON "treasure_subscriptions" USING btree ("status","next_billing_date");--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "address";
