import { db, organization, podSessionLogs, podSessions, pods, user } from "@ikyomm/database";
import { and, eq, getTableColumns, sql } from "drizzle-orm";
import { fetchPodSessionTransactionList } from "./list";

const sessionUsageSelect = {
  usageMinute: sql<
    number | null
  >`nullif(${podSessionLogs.payload}->>'rateMinute', '')::double precision`,
  creditMinute: sql<
    number | null
  >`nullif(${podSessionLogs.payload}->>'rateCredit', '')::double precision`,
};

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

export async function findPodSessionById(id: string, options?: { includeDeleted?: boolean }) {
  const rows = await db
    .select({
      ...getTableColumns(podSessions),
      podName: pods.name,
      userName: user.name,
      userEmail: user.email,
      companyName: organization.name,
      ...sessionUsageSelect,
    })
    .from(podSessions)
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
    )
    .where(
      options?.includeDeleted
        ? eq(podSessions.id, id)
        : and(eq(podSessions.id, id), eq(podSessions.isDeleted, false))
    )
    .limit(1);

  return rows[0] ? mapSessionRow(rows[0]) : null;
}

export async function getPodSessionUsage(id: string) {
  const session = await findPodSessionById(id, { includeDeleted: true });

  if (!session) {
    return null;
  }

  const transactions = await fetchPodSessionTransactionList(id, {
    page: 1,
    limit: 10,
    sortBy: "transactedAt",
    sortOrder: "desc",
  });

  return {
    sessionId: id,
    usageMinute: (session.usageMinute as number | null) ?? null,
    creditMinute: (session.creditMinute as number | null) ?? null,
    transactions: transactions.items,
  };
}
