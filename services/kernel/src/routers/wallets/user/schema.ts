import { userWallet, walletTransactions } from "@ikyomm/database";
import {
  createDbSelectSchema,
  createListQuerySchema,
  createListResponseSchema,
} from "@ikyomm/utils";
import { z } from "@hono/zod-openapi";

export const userWalletSchema = createDbSelectSchema(userWallet);
export const userWalletNullableSchema = userWalletSchema.nullable();

export const userWalletTransactionSchema = createDbSelectSchema(walletTransactions).extend({
  direction: z.enum(["credit", "debit", "internal"]),
});

export const userWalletTransactionListSortFields = [
  "id",
  "type",
  "status",
  "creditMinute",
  "transactedAt",
  "createdAt",
  "updatedAt",
] as const;

export const userWalletTransactionListQuerySchema = createListQuerySchema({
  sortFields: userWalletTransactionListSortFields,
  extraShape: {
    type: z.enum(["TRANSFER", "CREDIT", "DEBIT", "ADJUSTMENT"]).optional(),
    status: z.enum(["PENDING", "COMPLETED", "FAILED", "CANCELLED"]).optional(),
  },
});

export type UserWalletTransactionListQuery = z.infer<typeof userWalletTransactionListQuerySchema>;

export const userWalletTransactionListResponseSchema = createListResponseSchema(
  userWalletTransactionSchema
);
