import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  check,
  index,
  integer,
  pgTable,
  real,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { user } from "../../auth/schema";
import { referenceColumns } from "../../reference-columns";
import { addresses } from "../addresses/schema";
import { productVariants } from "../products/schema";
import { BillingInterval, SubscriptionStatus } from "./enums";

export const subscriptions = pgTable(
  "treasure_subscriptions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    variantId: text("variant_id")
      .notNull()
      .references(() => productVariants.id, { onDelete: "restrict" }),
    billingAddressId: text("billing_address_id").references(() => addresses.id, {
      onDelete: "set null",
    }),
    status: SubscriptionStatus("status").default("ACTIVE").notNull(),
    quantity: integer("quantity").default(1).notNull(),
    unitPrice: real("unit_price").notNull(),
    currency: text("currency").default("INR").notNull(),
    billingInterval: BillingInterval("billing_interval").default("MONTH").notNull(),
    billingIntervalCount: integer("billing_interval_count").default(1).notNull(),
    startDate: timestamp("start_date").defaultNow().notNull(),
    endDate: timestamp("end_date"),
    nextBillingDate: timestamp("next_billing_date").notNull(),
    pausedAt: timestamp("paused_at"),
    cancelledAt: timestamp("cancelled_at"),
    ...referenceColumns((): AnyPgColumn => user.id),
  },
  (table) => [
    index("treasure_subscriptions_user_id_idx").on(table.userId),
    index("treasure_subscriptions_variant_id_idx").on(table.variantId),
    index("treasure_subscriptions_status_next_billing_idx").on(table.status, table.nextBillingDate),
    check("treasure_subscriptions_quantity_check", sql`${table.quantity} > 0`),
    check("treasure_subscriptions_unit_price_check", sql`${table.unitPrice} >= 0`),
    check("treasure_subscriptions_interval_count_check", sql`${table.billingIntervalCount} > 0`),
    check(
      "treasure_subscriptions_date_range_check",
      sql`${table.endDate} is null or ${table.endDate} >= ${table.startDate}`
    ),
  ]
);
