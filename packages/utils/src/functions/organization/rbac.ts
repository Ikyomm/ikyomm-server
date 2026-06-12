import type { DB } from "@ikyomm/database";
import * as schema from "@ikyomm/database";
import { and, eq, inArray } from "drizzle-orm";
import { generateRandomId } from "../gen-id";
import {
  DEFAULT_ROLE_PERMISSION_PRESETS_BY_SLUG,
  type OrganizationRoleSlug,
} from "./role-permission-presets";

const DEFAULT_ORGANIZATION_ROLES = [
  {
    name: "Owner",
    slug: "owner",
    description: "Default owner role for company organizations.",
    panel: "company" as const,
  },
  {
    name: "Admin",
    slug: "admin",
    description: "Default admin role for company organizations.",
    panel: "company" as const,
  },
  {
    name: "Executive",
    slug: "executive",
    description: "Default executive role for company organizations.",
    panel: "company" as const,
  },
] as const;

type OrganizationRolesDb = Pick<DB, "select" | "insert" | "update" | "delete">;
type RoleSlug = OrganizationRoleSlug;

export async function ensureDefaultOrganizationRoles(
  db: OrganizationRolesDb,
  organizationId: string
) {
  const existingRoles = await db
    .select({
      id: schema.rbacRole.id,
      name: schema.rbacRole.name,
      slug: schema.rbacRole.slug,
      description: schema.rbacRole.description,
      isSystem: schema.rbacRole.isSystem,
      isActive: schema.rbacRole.isActive,
    })
    .from(schema.rbacRole)
    .where(
      and(
        eq(schema.rbacRole.panel, "company"),
        eq(schema.rbacRole.organizationId, organizationId),
        inArray(
          schema.rbacRole.slug,
          DEFAULT_ORGANIZATION_ROLES.map((role) => role.slug)
        )
      )
    );

  const existingRoleSlugs = new Set(existingRoles.map((role) => role.slug));
  const rolesToInsert = DEFAULT_ORGANIZATION_ROLES.filter(
    (role) => !existingRoleSlugs.has(role.slug)
  );

  const existingRoleBySlug = new Map(existingRoles.map((role) => [role.slug, role]));
  const rolesToUpdate = DEFAULT_ORGANIZATION_ROLES.filter((role) => {
    const existingRole = existingRoleBySlug.get(role.slug);
    if (!existingRole) {
      return false;
    }

    return (
      existingRole.name !== role.name ||
      existingRole.description !== role.description ||
      !existingRole.isSystem ||
      !existingRole.isActive
    );
  });

  for (const role of rolesToUpdate) {
    await db
      .update(schema.rbacRole)
      .set({
        name: role.name,
        description: role.description,
        isSystem: true,
        isActive: true,
      })
      .where(
        and(
          eq(schema.rbacRole.panel, "company"),
          eq(schema.rbacRole.organizationId, organizationId),
          eq(schema.rbacRole.slug, role.slug)
        )
      );
  }

  const insertedRoles =
    rolesToInsert.length > 0
      ? await db
          .insert(schema.rbacRole)
          .values(
            rolesToInsert.map((role) => ({
              id: generateRandomId(),
              name: role.name,
              slug: role.slug,
              description: role.description,
              panel: role.panel,
              organizationId,
              isSystem: true,
              isActive: true,
            }))
          )
          .returning({
            id: schema.rbacRole.id,
            slug: schema.rbacRole.slug,
          })
      : [];

  await seedDefaultPermissionsForRoles(db, [
    ...existingRoles.map((role) => ({ id: role.id, slug: role.slug as RoleSlug })),
    ...insertedRoles.map((role) => ({ id: role.id, slug: role.slug as RoleSlug })),
  ]);
}

async function seedDefaultPermissionsForRoles(
  db: OrganizationRolesDb,
  roles: Array<{ id: string; slug: RoleSlug }>
) {
  const desiredPermissionRows = roles.flatMap((role) =>
    (DEFAULT_ROLE_PERMISSION_PRESETS_BY_SLUG[role.slug] ?? []).map((permission) => ({
      roleId: role.id,
      resource: permission.resource,
      accessLevel: permission.accessLevel,
      actions: permission.actions,
    }))
  );

  if (desiredPermissionRows.length === 0) {
    return 0;
  }

  const roleIds = Array.from(new Set(roles.map((role) => role.id)));

  const existingPermissions = await db
    .select({
      id: schema.rbacRolePermission.id,
      roleId: schema.rbacRolePermission.roleId,
      resource: schema.rbacRolePermission.resource,
      accessLevel: schema.rbacRolePermission.accessLevel,
      actions: schema.rbacRolePermission.actions,
    })
    .from(schema.rbacRolePermission)
    .where(inArray(schema.rbacRolePermission.roleId, roleIds));

  const stableActionHash = (actions: Record<string, boolean>) =>
    JSON.stringify(
      Object.fromEntries(
        Object.entries(actions).sort(([left], [right]) => left.localeCompare(right))
      )
    );

  const desiredByRoleResource = new Map(
    desiredPermissionRows.map((permission) => [
      `${permission.roleId}:${permission.resource}`,
      permission,
    ])
  );
  const existingByRoleResource = new Map(
    existingPermissions.map((permission) => [
      `${permission.roleId}:${permission.resource}`,
      permission,
    ])
  );

  const rowsToInsert = desiredPermissionRows
    .filter(
      (permission) => !existingByRoleResource.has(`${permission.roleId}:${permission.resource}`)
    )
    .map((permission) => ({
      id: generateRandomId(),
      ...permission,
    }));

  const rowsToUpdate: Array<{
    id: string;
    accessLevel: "company" | "user" | "all";
    actions: Record<string, boolean>;
  }> = [];

  for (const existingPermission of existingPermissions) {
    const key = `${existingPermission.roleId}:${existingPermission.resource}`;
    const desired = desiredByRoleResource.get(key);
    if (!desired) {
      continue;
    }

    const accessLevelChanged = existingPermission.accessLevel !== desired.accessLevel;
    const actionsChanged =
      stableActionHash((existingPermission.actions ?? {}) as Record<string, boolean>) !==
      stableActionHash(desired.actions);

    if (!accessLevelChanged && !actionsChanged) {
      continue;
    }

    rowsToUpdate.push({
      id: existingPermission.id,
      accessLevel: desired.accessLevel,
      actions: desired.actions,
    });
  }

  const rowsToDelete = existingPermissions
    .filter(
      (permission) => !desiredByRoleResource.has(`${permission.roleId}:${permission.resource}`)
    )
    .map((permission) => permission.id);

  if (rowsToInsert.length > 0) {
    await db.insert(schema.rbacRolePermission).values(rowsToInsert);
  }

  for (const row of rowsToUpdate) {
    await db
      .update(schema.rbacRolePermission)
      .set({
        accessLevel: row.accessLevel,
        actions: row.actions,
      })
      .where(eq(schema.rbacRolePermission.id, row.id));
  }

  if (rowsToDelete.length > 0) {
    await db
      .delete(schema.rbacRolePermission)
      .where(inArray(schema.rbacRolePermission.id, rowsToDelete));
  }

  return rowsToInsert.length + rowsToUpdate.length + rowsToDelete.length;
}
