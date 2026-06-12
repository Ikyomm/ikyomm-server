import { organizationWallet, walletTransactions } from "@ikyomm/database";
import {
  createDbSelectSchema,
  createListQuerySchema,
  createListResponseSchema,
} from "@ikyomm/utils";
import { z } from "@hono/zod-openapi";

export const companyWalletSchema = createDbSelectSchema(organizationWallet);
export const companyWalletNullableSchema = companyWalletSchema.nullable();

export const companyWalletTransactionSchema = createDbSelectSchema(walletTransactions).extend({
  direction: z.enum(["credit", "debit", "internal"]),
});

export const companyWalletTransactionListSortFields = [
  "id",
  "type",
  "status",
  "creditMinute",
  "transactedAt",
  "createdAt",
  "updatedAt",
] as const;

export const companyWalletTransactionListQuerySchema = createListQuerySchema({
  sortFields: companyWalletTransactionListSortFields,
  extraShape: {
    type: z.enum(["TRANSFER", "CREDIT", "DEBIT", "ADJUSTMENT"]).optional(),
    status: z.enum(["PENDING", "COMPLETED", "FAILED", "CANCELLED"]).optional(),
  },
});

export type CompanyWalletTransactionListQuery = z.infer<
  typeof companyWalletTransactionListQuerySchema
>;

export const companyWalletTransactionListResponseSchema = createListResponseSchema(
  companyWalletTransactionSchema
);

export const companyWalletCreateSchema = z
  .object({
    reference: z.string().trim().min(1).optional(),
  })
  .optional()
  .default({});

export const companyWalletAddCreditsSchema = z.object({
  creditMinute: z.coerce.number().positive(),
  reference: z.string().trim().min(1).optional(),
  description: z.string().trim().min(1).optional(),
});
