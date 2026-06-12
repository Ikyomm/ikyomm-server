/** biome-ignore-all lint/suspicious/noExplicitAny: Drizzle query builders are intentionally passed through reusable helpers. */
import { getDB, walletTransactions } from "@ikyomm/database";
import { createTableListFetcher } from "@ikyomm/utils";
import { and, eq, or } from "drizzle-orm";
import type { CompanyWalletTransactionListQuery } from "./schema";
import { findCompanyWallet } from "./utils";

export const fetchCompanyWalletTransactionList = async (
  organizationId: string,
  params: CompanyWalletTransactionListQuery
) => {
  const wallet = await findCompanyWallet(organizationId);

  if (!wallet) {
    return {
      items: [],
      page: params.page,
      limit: params.limit,
      offset: params.offset ?? (params.page - 1) * params.limit,
      totalItems: 0,
    };
  }

  const fetchCompanyWalletTransactionBaseList = createTableListFetcher<
    typeof walletTransactions,
    typeof walletTransactions.$inferSelect,
    CompanyWalletTransactionListQuery
  >({
    db: getDB,
    table: walletTransactions,
    where: ({ params: listParams }) =>
      and(
        eq(walletTransactions.isDeleted, false),
        or(
          eq(walletTransactions.fromOrganizationWalletId, wallet.id),
          eq(walletTransactions.toOrganizationWalletId, wallet.id)
        ),
        listParams.type ? eq(walletTransactions.type, listParams.type) : undefined,
        listParams.status ? eq(walletTransactions.status, listParams.status) : undefined
      ),
    search: {
      exact: [
        walletTransactions.id,
        walletTransactions.reference,
        walletTransactions.fromOrganizationWalletId,
        walletTransactions.toOrganizationWalletId,
      ],
      contains: [walletTransactions.description],
    },
    sorting: {
      defaultBy: "transactedAt",
      defaultOrder: "desc",
    },
    sortColumns: {
      id: walletTransactions.id,
      type: walletTransactions.type,
      status: walletTransactions.status,
      creditMinute: walletTransactions.creditMinute,
      transactedAt: walletTransactions.transactedAt,
      createdAt: walletTransactions.createdAt,
      updatedAt: walletTransactions.updatedAt,
    },
  });

  const response = await fetchCompanyWalletTransactionBaseList(params);

  return {
    ...response,
    items: response.items.map((transaction) => ({
      ...transaction,
      direction:
        transaction.fromOrganizationWalletId === wallet.id &&
        transaction.toOrganizationWalletId === wallet.id
          ? transaction.type === "DEBIT"
            ? ("debit" as const)
            : transaction.type === "CREDIT"
              ? ("credit" as const)
              : ("internal" as const)
          : transaction.toOrganizationWalletId === wallet.id
            ? ("credit" as const)
            : ("debit" as const),
    })),
  };
};
