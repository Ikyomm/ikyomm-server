import { getDB, rbacRole } from "@ikyomm/database";
import { createTableListFetcher } from "@ikyomm/utils";
import { and, eq, isNull } from "drizzle-orm";
import type { ScopedRoleListQuery } from "./schema";

export const fetchRoleListBase = createTableListFetcher<
  typeof rbacRole,
  typeof rbacRole.$inferSelect,
  ScopedRoleListQuery
>({
  db: getDB,
  table: rbacRole,
  where: ({ params }) => {
    const panel = params.panel ?? "ikyomm";

    if (panel === "company") {
      return params.organizationId
        ? and(eq(rbacRole.panel, "company"), eq(rbacRole.organizationId, params.organizationId))
        : eq(rbacRole.panel, "company");
    }

    return and(eq(rbacRole.panel, panel), isNull(rbacRole.organizationId));
  },
  search: {
    exact: [rbacRole.id, rbacRole.slug],
    contains: [rbacRole.name, rbacRole.description],
  },
  filterColumns: {
    isActive: rbacRole.isActive,
  },
  sorting: {
    defaultBy: "createdAt",
    defaultOrder: "desc",
  },
  sortColumns: {
    name: rbacRole.name,
    slug: rbacRole.slug,
    createdAt: rbacRole.createdAt,
    updatedAt: rbacRole.updatedAt,
  },
});
