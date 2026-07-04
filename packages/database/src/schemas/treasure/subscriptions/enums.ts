import { pgEnum } from "drizzle-orm/pg-core";

export const SubscriptionStatus = pgEnum("treasure_subscription_status", [
  "ACTIVE",
  "PAUSED",
  "CANCELLED",
  "EXPIRED",
]);

export const BillingInterval = pgEnum("treasure_billing_interval", [
  "DAY",
  "WEEK",
  "MONTH",
  "YEAR",
]);

export type SubscriptionStatus = (typeof SubscriptionStatus.enumValues)[number];
export type BillingInterval = (typeof BillingInterval.enumValues)[number];
