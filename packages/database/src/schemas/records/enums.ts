import { pgEnum } from "drizzle-orm/pg-core";

export const OmmPodType = pgEnum("ommpod_type", ["NEO", "PRIMO", "RESTORE", "SIGNATURE"]);
export const AromaDefuserContainerType = pgEnum("aroma_defuser_container_type", [
  "SETTLE",
  "RISE",
  "RESTORE",
  "DEPTHS",
]);
export const OmmPodStatus = pgEnum("ommpod_status", [
  "ACTIVE",
  "INACTIVE",
  "MAINTENANCE",
  "DECOMMISSIONED",
]);
export const WalletTransactionType = pgEnum("wallet_transaction_type", [
  "TRANSFER",
  "CREDIT",
  "DEBIT",
  "ADJUSTMENT",
]);
export const WalletTransactionStatus = pgEnum("wallet_transaction_status", [
  "PENDING",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
]);

export type OmmPodType = (typeof OmmPodType.enumValues)[number];
export type AromaDefuserContainerType = (typeof AromaDefuserContainerType.enumValues)[number];
export type OmmPodStatus = (typeof OmmPodStatus.enumValues)[number];
export type WalletTransactionType = (typeof WalletTransactionType.enumValues)[number];
export type WalletTransactionStatus = (typeof WalletTransactionStatus.enumValues)[number];
