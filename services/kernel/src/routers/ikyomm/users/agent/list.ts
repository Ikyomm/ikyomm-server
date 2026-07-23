/** biome-ignore-all lint/suspicious/noExplicitAny: Drizzle list helper accepts flexible join builders. */
import { getDB, organization, user, userWallet } from "@ikyomm/database";
import { createTableListFetcher } from "@ikyomm/utils";
import { and, eq, isNotNull, isNull, ne } from "drizzle-orm";
import type { ScopedOmmpodsAgentUserListQuery } from "./schema";

function appUserListJoins(queryBuilder: any) {
  return queryBuilder
    .leftJoin(organization, eq(organization.id, user.company))
    .leftJoin(userWallet, and(eq(userWallet.userId, user.id), eq(userWallet.isDeleted, false)));
}

function mapAppUserListItem(row: Record<string, unknown>) {
  const { organization: organizationData, user_wallet: walletData, ...userData } = row;

  return {
    ...userData,
    organization: organizationData,
    wallet: walletData,
  };
}

export const fetchOmmpodsAgentUserList = createTableListFetcher<
  typeof user,
  ReturnType<typeof mapAppUserListItem>,
  ScopedOmmpodsAgentUserListQuery
>({
  db: getDB,
  table: user,
  select: () => ({
    id: user.id,
    name: user.name,
    email: user.email,
    emailVerified: user.emailVerified,
    country: user.country,
    state: user.state,
    city: user.city,
    company: user.company,
    employeeId: user.employeeId,
    employeeEmail: user.employeeEmail,
    image: user.image,
    role: user.role,
    panel: user.panel,
    banned: user.banned,
    banReason: user.banReason,
    banExpires: user.banExpires,
    phoneNumber: user.phoneNumber,
    phoneNumberVerified: user.phoneNumberVerified,
    deletedAt: user.deletedAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    createdByUser: user.createdByUser,
    updatedByUser: user.updatedByUser,
    deletedByUser: user.deletedByUser,
    isDeleted: user.isDeleted,
    organization,
    user_wallet: userWallet,
  }),
  joins: appUserListJoins,
  where: ({ params }) =>
    and(
      eq(user.panel, "app"),
      eq(user.isDeleted, params.isDeleted ?? false),
      params.excludeUserId ? ne(user.id, params.excludeUserId) : undefined,
      params.companyAssigned === true ? isNotNull(user.company) : undefined,
      params.companyAssigned === false ? isNull(user.company) : undefined
    ),
  search: {
    exact: [user.id, user.company],
    prefix: [user.email, user.phoneNumber],
    contains: [
      user.name,
      user.employeeId,
      user.employeeEmail,
      user.city,
      user.state,
      organization.name,
    ],
  },
  filterColumns: {
    role: user.role,
    company: user.company,
    emailVerified: user.emailVerified,
    banned: user.banned,
  },
  sorting: {
    defaultBy: "createdAt",
    defaultOrder: "desc",
  },
  sortColumns: {
    name: user.name,
    email: user.email,
    role: user.role,
    phoneNumber: user.phoneNumber,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  },
  counts: {
    totalJoins: "data",
  },
  mapItem: mapAppUserListItem,
});
