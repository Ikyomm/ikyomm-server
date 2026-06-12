/** biome-ignore-all lint/suspicious/noExplicitAny: Drizzle query builders are intentionally passed through reusable helpers. */
import { getDB, member, user } from "@ikyomm/database";
import { createTableListFetcher } from "@ikyomm/utils";
import { and, eq } from "drizzle-orm";
import type { ScopedMemberListQuery } from "./schema";

function memberListJoins(queryBuilder: any) {
  return queryBuilder.innerJoin(user, eq(user.id, member.userId));
}

function mapMemberListItem(row: Record<string, unknown>) {
  const { user: userData, ...memberData } = row;

  return {
    ...memberData,
    user: userData,
  };
}

export const fetchMemberList = createTableListFetcher<
  typeof member,
  ReturnType<typeof mapMemberListItem>,
  ScopedMemberListQuery
>({
  db: getDB,
  table: member,
  select: () => ({
    id: member.id,
    organizationId: member.organizationId,
    userId: member.userId,
    role: member.role,
    panel: member.panel,
    deletedAt: member.deletedAt,
    createdAt: member.createdAt,
    updatedAt: member.updatedAt,
    createdByUser: member.createdByUser,
    updatedByUser: member.updatedByUser,
    deletedByUser: member.deletedByUser,
    isDeleted: member.isDeleted,
    user,
  }),
  joins: memberListJoins,
  where: and(eq(member.isDeleted, false), eq(user.isDeleted, false)),
  search: {
    exact: [member.id, member.organizationId],
    prefix: [user.email, user.phoneNumber],
    contains: [user.name],
  },
  filterColumns: {
    organizationId: member.organizationId,
    role: member.role,
    panel: member.panel,
    emailVerified: user.emailVerified,
  },
  sorting: {
    defaultBy: "createdAt",
    defaultOrder: "desc",
  },
  sortColumns: {
    name: user.name,
    email: user.email,
    role: member.role,
    createdAt: member.createdAt,
    updatedAt: member.updatedAt,
  },
  counts: {
    totalJoins: "data",
  },
  mapItem: mapMemberListItem,
});
