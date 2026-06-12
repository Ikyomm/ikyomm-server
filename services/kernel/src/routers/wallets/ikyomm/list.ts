/** biome-ignore-all lint/suspicious/noExplicitAny: Drizzle query builders are intentionally passed through reusable helpers. */
import { getDB, walletTransactions } from "@ikyomm/database";
import { createTableListFetcher } from "@ikyomm/utils";
import { and, eq, or } from "drizzle-orm";
import type { IkyommWalletTransactionListQuery } from "./schema";
import { findIkyommWallet } from "./utils";

export const fetchIkyommWalletTransactionList = async (
  params: IkyommWalletTransactionListQuery
) => {
  const wallet = await findIkyommWallet();

  if (!wallet) {
    return {
      items: [],
      page: params.page,
      limit: params.limit,
      offset: params.offset ?? (params.page - 1) * params.limit,
      totalItems: 0,
    };
  }

  const fetchIkyommWalletTransactionBaseList = createTableListFetcher<
    typeof walletTransactions,
    typeof walletTransactions.$inferSelect,
    IkyommWalletTransactionListQuery
  >({
    db: getDB,
    table: walletTransactions,
    where: ({ params: listParams }) =>
      and(
        eq(walletTransactions.isDeleted, false),
        or(
          eq(walletTransactions.fromIkyommWalletId, wallet.id),
          eq(walletTransactions.toIkyommWalletId, wallet.id)
        ),
        listParams.type ? eq(walletTransactions.type, listParams.type) : undefined,
        listParams.status ? eq(walletTransactions.status, listParams.status) : undefined
      ),
    search: {
      exact: [
        walletTransactions.id,
        walletTransactions.reference,
        walletTransactions.fromIkyommWalletId,
        walletTransactions.toIkyommWalletId,
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

  const response = await fetchIkyommWalletTransactionBaseList(params);

  return {
    ...response,
    items: response.items.map((transaction) => ({
      ...transaction,
      direction:
        transaction.fromIkyommWalletId === wallet.id && transaction.toIkyommWalletId === wallet.id
          ? transaction.type === "DEBIT"
            ? ("debit" as const)
            : transaction.type === "CREDIT"
              ? ("credit" as const)
              : ("internal" as const)
          : transaction.toIkyommWalletId === wallet.id
            ? ("credit" as const)
            : ("debit" as const),
    })),
  };
};
