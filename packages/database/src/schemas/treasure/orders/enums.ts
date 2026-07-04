import { pgEnum } from "drizzle-orm/pg-core";

export const OrderStatus = pgEnum("treasure_order_status", [
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "REFUNDED",
]);

export const PaymentStatus = pgEnum("treasure_payment_status", [
  "PENDING",
  "PAID",
  "FAILED",
  "REFUNDED",
  "PARTIALLY_REFUNDED",
]);

export const PaymentMethod = pgEnum("treasure_payment_method", [
  "CARD",
  "UPI",
  "NET_BANKING",
  "WALLET",
  "CASH_ON_DELIVERY",
  "OTHER",
]);

export type OrderStatus = (typeof OrderStatus.enumValues)[number];
export type PaymentStatus = (typeof PaymentStatus.enumValues)[number];
export type PaymentMethod = (typeof PaymentMethod.enumValues)[number];
