import { sql } from "drizzle-orm";
import { check, index, pgTable, real, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { organization, user } from "../auth";
import { WalletTransactionStatus, WalletTransactionType } from "./enums";
import { referenceColumns } from "../reference-columns";

export const userWallet = pgTable(
  "user_wallet",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    creditMinute: real("credit_minute").notNull().default(0),
    reference: text("reference"),
    ...referenceColumns(() => user.id),
  },
  (table) => [
    uniqueIndex("user_wallet_userId_uidx").on(table.userId),
    index("user_wallet_creditMinute_idx").on(table.creditMinute),
    index("user_wallet_isDeleted_createdAt_idx").on(table.isDeleted, table.createdAt),
    index("user_wallet_isDeleted_updatedAt_idx").on(table.isDeleted, table.updatedAt),
  ]
);

export const organizationWallet = pgTable(
  "organization_wallet",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    creditMinute: real("credit_minute").notNull().default(0),
    reference: text("reference"),
    ...referenceColumns(() => user.id),
  },
  (table) => [
    uniqueIndex("organization_wallet_organizationId_uidx").on(table.organizationId),
    index("organization_wallet_creditMinute_idx").on(table.creditMinute),
    index("organization_wallet_isDeleted_createdAt_idx").on(table.isDeleted, table.createdAt),
    index("organization_wallet_isDeleted_updatedAt_idx").on(table.isDeleted, table.updatedAt),
  ]
);

export const ikyommWallet = pgTable(
  "ikyomm_wallet",
  {
    id: text("id").primaryKey(),
    singletonKey: text("singleton_key").notNull().default("ikyomm"),
    creditMinute: real("credit_minute").notNull().default(0),
    reference: text("reference"),
    ...referenceColumns(() => user.id),
  },
  (table) => [
    uniqueIndex("ikyomm_wallet_singletonKey_uidx").on(table.singletonKey),
    index("ikyomm_wallet_creditMinute_idx").on(table.creditMinute),
    index("ikyomm_wallet_isDeleted_createdAt_idx").on(table.isDeleted, table.createdAt),
    index("ikyomm_wallet_isDeleted_updatedAt_idx").on(table.isDeleted, table.updatedAt),
    check("ikyomm_wallet_singletonKey_check", sql`${table.singletonKey} = 'ikyomm'`),
  ]
);

export const walletTransactions = pgTable(
  "wallet_transactions",
  {
    id: text("id").primaryKey(),
    type: WalletTransactionType("type").notNull().default("TRANSFER"),
    status: WalletTransactionStatus("status").notNull().default("COMPLETED"),
    creditMinute: real("credit_minute").notNull(),
    reference: text("reference"),
    description: text("description"),
    transactedAt: timestamp("transacted_at").defaultNow().notNull(),

    fromUserWalletId: text("from_user_wallet_id").references(() => userWallet.id, {
      onDelete: "restrict",
    }),
    fromOrganizationWalletId: text("from_organization_wallet_id").references(
      () => organizationWallet.id,
      { onDelete: "restrict" }
    ),
    fromIkyommWalletId: text("from_ikyomm_wallet_id").references(() => ikyommWallet.id, {
      onDelete: "restrict",
    }),
    toUserWalletId: text("to_user_wallet_id").references(() => userWallet.id, {
      onDelete: "restrict",
    }),
    toOrganizationWalletId: text("to_organization_wallet_id").references(
      () => organizationWallet.id,
      { onDelete: "restrict" }
    ),
    toIkyommWalletId: text("to_ikyomm_wallet_id").references(() => ikyommWallet.id, {
      onDelete: "restrict",
    }),

    ...referenceColumns(() => user.id),
  },
  (table) => [
    index("wallet_transactions_type_idx").on(table.type),
    index("wallet_transactions_status_idx").on(table.status),
    index("wallet_transactions_reference_idx").on(table.reference),
    index("wallet_transactions_transactedAt_idx").on(table.transactedAt),
    index("wallet_transactions_fromUserWalletId_idx").on(table.fromUserWalletId),
    index("wallet_transactions_fromOrganizationWalletId_idx").on(table.fromOrganizationWalletId),
    index("wallet_transactions_fromIkyommWalletId_idx").on(table.fromIkyommWalletId),
    index("wallet_transactions_toUserWalletId_idx").on(table.toUserWalletId),
    index("wallet_transactions_toOrganizationWalletId_idx").on(table.toOrganizationWalletId),
    index("wallet_transactions_toIkyommWalletId_idx").on(table.toIkyommWalletId),
    index("wallet_transactions_isDeleted_createdAt_idx").on(table.isDeleted, table.createdAt),
    index("wallet_transactions_isDeleted_updatedAt_idx").on(table.isDeleted, table.updatedAt),
    check("wallet_transactions_creditMinute_check", sql`${table.creditMinute} > 0`),
    check(
      "wallet_transactions_single_source_check",
      sql`num_nonnulls(${table.fromUserWalletId}, ${table.fromOrganizationWalletId}, ${table.fromIkyommWalletId}) = 1`
    ),
    check(
      "wallet_transactions_single_destination_check",
      sql`num_nonnulls(${table.toUserWalletId}, ${table.toOrganizationWalletId}, ${table.toIkyommWalletId}) = 1`
    ),
  ]
);
