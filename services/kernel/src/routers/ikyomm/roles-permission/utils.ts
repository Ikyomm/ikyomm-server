import { db, rbacRole, rbacRolePermission } from "@ikyomm/database";
import { generateRandomId } from "@ikyomm/utils";
import { and, eq, inArray, isNull, ne } from "drizzle-orm";
import { fetchRoleListBase } from "./list";
import type { RoleListQuery, rolePermissionActionsSchema } from "./schema";
import type z from "zod";

type RolePermissionActions = z.infer<typeof rolePermissionActionsSchema>;
type RolePanelScope = "ikyomm" | "ommpods" | "company" | "app";

export function createRoleSlug(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function findRoleById(id: string) {
  return db
    .select()
    .from(rbacRole)
    .where(eq(rbacRole.id, id))
    .limit(1)
    .then((rows) => rows[0]);
}

export async function findPermissionById(roleId: string, permissionId: string) {
  return db
    .select()
    .from(rbacRolePermission)
    .where(and(eq(rbacRolePermission.id, permissionId), eq(rbacRolePermission.roleId, roleId)))
    .limit(1)
    .then((rows) => rows[0]);
}

export async function findRoleSlugConflict(
  slug: string,
  excludeRoleId?: string,
  scope: { panel?: RolePanelScope; organizationId?: string | null } = {}
) {
  const panel = scope.panel ?? "ikyomm";
  const organizationId = scope.organizationId ?? null;

  const whereClause = excludeRoleId
    ? and(
        eq(rbacRole.panel, panel),
        organizationId
          ? eq(rbacRole.organizationId, organizationId)
          : isNull(rbacRole.organizationId),
        eq(rbacRole.slug, slug),
        ne(rbacRole.id, excludeRoleId)
      )
    : and(
        eq(rbacRole.panel, panel),
        organizationId
          ? eq(rbacRole.organizationId, organizationId)
          : isNull(rbacRole.organizationId),
        eq(rbacRole.slug, slug)
      );

  return db
    .select({ id: rbacRole.id })
    .from(rbacRole)
    .where(whereClause)
    .limit(1)
    .then((rows) => rows[0]);
}

export async function findRoleSlugAvailability(
  slug: string,
  scope: { panel?: RolePanelScope; organizationId?: string | null } = {}
) {
  const conflict = await findRoleSlugConflict(createRoleSlug(slug), undefined, scope);
  return !conflict;
}

export async function attachPermissions<TRole extends { id: string }>(roles: TRole[]) {
  if (roles.length === 0) {
    return [];
  }

  const permissions = await db
    .select()
    .from(rbacRolePermission)
    .where(
      inArray(
        rbacRolePermission.roleId,
        roles.map((role) => role.id)
      )
    );

  const permissionsByRoleId = new Map<string, typeof permissions>();

  for (const permission of permissions) {
    const rolePermissions = permissionsByRoleId.get(permission.roleId) ?? [];
    rolePermissions.push(permission);
    permissionsByRoleId.set(permission.roleId, rolePermissions);
  }

  return roles.map((role) => ({
    ...role,
    permissions: permissionsByRoleId.get(role.id) ?? [],
  }));
}

export async function fetchRoleList(query: RoleListQuery) {
  const roleList = await fetchRoleListBase({
    ...query,
  });

  return {
    ...roleList,
    items: await attachPermissions(roleList.items),
  };
}

export async function findRoleDetailsById(id: string) {
  const role = await findRoleById(id);

  if (!role) {
    return null;
  }

  return attachPermissions([role]).then((roles) => roles[0]);
}

export function normalizePermissionValues(input: {
  actions?: RolePermissionActions;
  accessLevel?: "company" | "user" | "all";
}) {
  return {
    accessLevel: input.accessLevel ?? "all",
    actions: input.actions ?? {},
  };
}

export function createPermissionValues(
  roleId: string,
  input: {
    resource: string;
    accessLevel?: "company" | "user" | "all";
    actions?: RolePermissionActions;
  }
) {
  return {
    id: generateRandomId(),
    roleId,
    resource: input.resource,
    ...normalizePermissionValues(input),
  };
}
