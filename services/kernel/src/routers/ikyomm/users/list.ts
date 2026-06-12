import { getDB, user } from "@ikyomm/database";
import { createTableListFetcher } from "@ikyomm/utils";
import { and, eq, ne } from "drizzle-orm";
import type { ScopedOmmpodsUserListQuery } from "./schema";

export const fetchOmmpodsUserList = createTableListFetcher<
  typeof user,
  typeof user.$inferSelect,
  ScopedOmmpodsUserListQuery
>({
  db: getDB,
  table: user,
  where: ({ params }) =>
    and(
      eq(user.panel, "ikyomm"),
      eq(user.isDeleted, params.isDeleted ?? false),
      ne(user.role, "agent"),
      params.excludeUserId ? ne(user.id, params.excludeUserId) : undefined
    ),
  search: {
    exact: [user.id, user.role],
    prefix: [user.email, user.phoneNumber],
    contains: [user.name, user.employeeId, user.employeeEmail, user.city, user.state],
  },
  filterColumns: {
    role: user.role,
    emailVerified: user.emailVerified,
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
});
