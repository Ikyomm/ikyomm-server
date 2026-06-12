import { pgEnum } from "drizzle-orm/pg-core";

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
