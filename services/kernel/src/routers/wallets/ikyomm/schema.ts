import { ikyommWallet, walletTransactions } from "@ikyomm/database";
import {
  createDbSelectSchema,
  createListQuerySchema,
  createListResponseSchema,
} from "@ikyomm/utils";
import { z } from "@hono/zod-openapi";

export const ikyommWalletSchema = createDbSelectSchema(ikyommWallet);
export const ikyommWalletNullableSchema = ikyommWalletSchema.nullable();

export const ikyommWalletTransactionSchema = createDbSelectSchema(walletTransactions).extend({
  direction: z.enum(["credit", "debit", "internal"]),
});

export const ikyommWalletTransactionListSortFields = [
  "id",
  "type",
  "status",
  "creditMinute",
  "transactedAt",
  "createdAt",
  "updatedAt",
] as const;

export const ikyommWalletTransactionListQuerySchema = createListQuerySchema({
  sortFields: ikyommWalletTransactionListSortFields,
  extraShape: {
    type: z.enum(["TRANSFER", "CREDIT", "DEBIT", "ADJUSTMENT"]).optional(),
    status: z.enum(["PENDING", "COMPLETED", "FAILED", "CANCELLED"]).optional(),
  },
});

export type IkyommWalletTransactionListQuery = z.infer<
  typeof ikyommWalletTransactionListQuerySchema
>;

export const ikyommWalletTransactionListResponseSchema = createListResponseSchema(
  ikyommWalletTransactionSchema
);

export const ikyommWalletCreateSchema = z
  .object({
    reference: z.string().trim().min(1).optional(),
  })
  .optional()
  .default({});

export const ikyommWalletAddCreditsSchema = z.object({
  creditMinute: z.coerce.number().positive(),
  type: z.enum(["CREDIT", "DEBIT"]).default("CREDIT"),
  reference: z.string().trim().min(1).optional(),
  description: z.string().trim().min(1).optional(),
});

export const ikyommWalletMessageResponseSchema = z.object({
  message: z.string(),
});
