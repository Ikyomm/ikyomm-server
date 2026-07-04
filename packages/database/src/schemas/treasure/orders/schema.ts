import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { user } from "../../auth/schema";
import { referenceColumns } from "../../reference-columns";
import { addresses } from "../addresses/schema";
import { productVariants } from "../products/schema";
import { OrderStatus, PaymentMethod, PaymentStatus } from "./enums";

export type OrderAddressSnapshot = {
  recipientName: string;
  phoneNumber?: string | null;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  state: string;
  country: string;
  pincode: string;
};

export const orders = pgTable(
  "treasure_orders",
  {
    id: text("id").primaryKey(),
    orderNumber: text("order_number").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    billingAddressId: text("billing_address_id").references(() => addresses.id, {
      onDelete: "set null",
    }),
    shippingAddressId: text("shipping_address_id").references(() => addresses.id, {
      onDelete: "set null",
    }),
    billingAddressSnapshot: jsonb("billing_address_snapshot")
      .$type<OrderAddressSnapshot>()
      .notNull(),
    shippingAddressSnapshot: jsonb("shipping_address_snapshot")
      .$type<OrderAddressSnapshot>()
      .notNull(),
    status: OrderStatus("status").default("PENDING").notNull(),
    subtotalAmount: real("subtotal_amount").default(0).notNull(),
    discountAmount: real("discount_amount").default(0).notNull(),
    shippingAmount: real("shipping_amount").default(0).notNull(),
    taxAmount: real("tax_amount").default(0).notNull(),
    totalAmount: real("total_amount").notNull(),
    currency: text("currency").default("INR").notNull(),
    notes: text("notes"),
    ...referenceColumns((): AnyPgColumn => user.id),
  },
  (table) => [
    uniqueIndex("treasure_orders_order_number_uidx").on(table.orderNumber),
    index("treasure_orders_user_id_idx").on(table.userId),
    index("treasure_orders_status_idx").on(table.status),
    index("treasure_orders_created_at_idx").on(table.createdAt),
    check("treasure_orders_subtotal_amount_check", sql`${table.subtotalAmount} >= 0`),
    check("treasure_orders_discount_amount_check", sql`${table.discountAmount} >= 0`),
    check("treasure_orders_shipping_amount_check", sql`${table.shippingAmount} >= 0`),
    check("treasure_orders_tax_amount_check", sql`${table.taxAmount} >= 0`),
    check("treasure_orders_total_amount_check", sql`${table.totalAmount} >= 0`),
  ]
);

export const orderItems = pgTable(
  "treasure_order_items",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    variantId: text("variant_id")
      .notNull()
      .references(() => productVariants.id, { onDelete: "restrict" }),
    sku: text("sku").notNull(),
    productName: text("product_name").notNull(),
    variantName: text("variant_name").notNull(),
    quantity: integer("quantity").notNull(),
    unitPrice: real("unit_price").notNull(),
    total: real("total").notNull(),
    ...referenceColumns((): AnyPgColumn => user.id),
  },
  (table) => [
    index("treasure_order_items_order_id_idx").on(table.orderId),
    index("treasure_order_items_variant_id_idx").on(table.variantId),
    check("treasure_order_items_quantity_check", sql`${table.quantity} > 0`),
    check("treasure_order_items_unit_price_check", sql`${table.unitPrice} >= 0`),
    check("treasure_order_items_total_check", sql`${table.total} >= 0`),
  ]
);

export const payments = pgTable(
  "treasure_payments",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "restrict" }),
    externalReference: text("external_reference"),
    amount: real("amount").notNull(),
    currency: text("currency").default("INR").notNull(),
    status: PaymentStatus("status").default("PENDING").notNull(),
    method: PaymentMethod("method").notNull(),
    paidAt: timestamp("paid_at"),
    failureReason: text("failure_reason"),
    ...referenceColumns((): AnyPgColumn => user.id),
  },
  (table) => [
    index("treasure_payments_order_id_idx").on(table.orderId),
    index("treasure_payments_status_idx").on(table.status),
    uniqueIndex("treasure_payments_external_reference_uidx").on(table.externalReference),
    check("treasure_payments_amount_check", sql`${table.amount} > 0`),
  ]
);
