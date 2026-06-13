/** biome-ignore-all lint/suspicious/noExplicitAny: Drizzle query builders are intentionally passed through reusable helpers. */
import {
  db,
  getDB,
  organization,
  podSessionLogs,
  podSessions,
  pods,
  user,
  walletTransactions,
} from "@ikyomm/database";
import { createTableListFetcher, executeListQuery } from "@ikyomm/utils";
import { and, eq, getTableColumns, gte, isNotNull, isNull, lt, sql } from "drizzle-orm";
import type {
  PodSessionListQuery,
  PodSessionLogListQuery,
  PodSessionTransactionListQuery,
} from "./schema";

const sessionUsageSelect = {
  usageMinute: sql<
    number | null
  >`nullif(${podSessionLogs.payload}->>'rateMinute', '')::double precision`,
  creditMinute: sql<
    number | null
  >`nullif(${podSessionLogs.payload}->>'rateCredit', '')::double precision`,
};

function startOfDateParam(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function nextDayOfDateParam(value: string) {
  const date = startOfDateParam(value);
  date.setUTCDate(date.getUTCDate() + 1);
  return date;
}

function buildSessionListWhere(params: PodSessionListQuery) {
  return [
    eq(podSessions.isDeleted, params.isDeleted ?? false),
    params.userScope === "company"
      ? isNotNull(podSessions.companyId)
      : params.userScope === "ikyomm"
        ? isNull(podSessions.companyId)
        : undefined,
    params.startDate ? gte(podSessions.startAt, startOfDateParam(params.startDate)) : undefined,
    params.endDate ? lt(podSessions.startAt, nextDayOfDateParam(params.endDate)) : undefined,
  ];
}

function sessionListJoins(queryBuilder: any) {
  return queryBuilder
    .leftJoin(pods, eq(pods.id, podSessions.podId))
    .leftJoin(user, eq(user.id, podSessions.userId))
    .leftJoin(organization, eq(organization.id, podSessions.companyId))
    .leftJoin(
      podSessionLogs,
      and(
        eq(podSessionLogs.sessionId, podSessions.id),
        eq(podSessionLogs.eventType, "SESSION_CREATED"),
        eq(podSessionLogs.isDeleted, false)
      )
    );
}

function mapSessionRow(row: Record<string, unknown>) {
  const { podName, userName, userEmail, companyName, usageMinute, creditMinute, ...session } = row;

  return {
    ...(session as Record<string, unknown>),
    pod: session.podId
      ? {
          id: String(session.podId),
          name: (podName as string | null | undefined) ?? null,
        }
      : null,
    user: session.userId
      ? {
          id: String(session.userId),
          name: (userName as string | null | undefined) ?? null,
          email: (userEmail as string | null | undefined) ?? null,
        }
      : null,
    company: session.companyId
      ? {
          id: String(session.companyId),
          name: (companyName as string | null | undefined) ?? null,
        }
      : null,
    usageMinute: usageMinute === null || usageMinute === undefined ? null : Number(usageMinute),
    creditMinute: creditMinute === null || creditMinute === undefined ? null : Number(creditMinute),
  };
}

export const fetchPodSessionList = createTableListFetcher<
  typeof podSessions,
  ReturnType<typeof mapSessionRow>,
  PodSessionListQuery
>({
  db: getDB,
  table: podSessions,
  select: (columns) => ({
    ...columns,
    podName: pods.name,
    userName: user.name,
    userEmail: user.email,
    companyName: organization.name,
    ...sessionUsageSelect,
  }),
  joins: sessionListJoins,
  where: ({ params }) => buildSessionListWhere(params),
  search: {
    exact: [podSessions.id, podSessions.podId, podSessions.userId, podSessions.companyId],
    prefix: [pods.name, user.name, user.email, organization.name],
  },
  filterColumns: {
    status: podSessions.status,
    podId: podSessions.podId,
    userId: podSessions.userId,
    companyId: podSessions.companyId,
  },
  sorting: {
    defaultBy: "createdAt",
    defaultOrder: "desc",
  },
  sortColumns: {
    id: podSessions.id,
    status: podSessions.status,
    podId: podSessions.podId,
    userId: podSessions.userId,
    companyId: podSessions.companyId,
    startAt: podSessions.startAt,
    endAt: podSessions.endAt,
    createdAt: podSessions.createdAt,
    updatedAt: podSessions.updatedAt,
  },
  counts: {
    totalJoins: "data",
  },
  mapItem: mapSessionRow,
});

export async function fetchPodSessionLogList(sessionId: string, params: PodSessionLogListQuery) {
  return executeListQuery({
    db,
    params,
    select: getTableColumns(podSessionLogs),
    from: podSessionLogs,
    countDistinctOn: podSessionLogs.id,
    where: ({ params }) =>
      and(
        eq(podSessionLogs.sessionId, sessionId),
        eq(podSessionLogs.isDeleted, params.isDeleted ?? false)
      ),
    search: {
      value: params.search,
      fields: [podSessionLogs.id],
    },
    filterColumns: {
      eventType: podSessionLogs.eventType,
    },
    sorting: {
      defaultBy: "occurredAt",
      defaultOrder: "desc",
    },
    sortColumns: {
      id: podSessionLogs.id,
      eventType: podSessionLogs.eventType,
      occurredAt: podSessionLogs.occurredAt,
      createdAt: podSessionLogs.createdAt,
      updatedAt: podSessionLogs.updatedAt,
    },
  });
}

function mapTransactionRow(transaction: typeof walletTransactions.$inferSelect) {
  return {
    ...transaction,
    direction:
      transaction.type === "DEBIT"
        ? "debit"
        : transaction.type === "CREDIT"
          ? "credit"
          : "internal",
  };
}

export async function fetchPodSessionTransactionList(
  sessionId: string,
  params: PodSessionTransactionListQuery
) {
  return executeListQuery({
    db,
    params,
    select: getTableColumns(walletTransactions),
    from: walletTransactions,
    countDistinctOn: walletTransactions.id,
    where: ({ params }) =>
      and(
        eq(walletTransactions.reference, sessionId),
        eq(walletTransactions.isDeleted, params.isDeleted ?? false)
      ),
    search: {
      value: params.search,
      fields: [
        walletTransactions.id,
        walletTransactions.reference,
        walletTransactions.description,
        walletTransactions.fromUserWalletId,
        walletTransactions.toUserWalletId,
        walletTransactions.fromOrganizationWalletId,
        walletTransactions.toOrganizationWalletId,
        walletTransactions.fromIkyommWalletId,
        walletTransactions.toIkyommWalletId,
      ],
    },
    filterColumns: {
      type: walletTransactions.type,
      status: walletTransactions.status,
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
    mapItem: mapTransactionRow,
  });
}
