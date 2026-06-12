import { PermissionAccessLevel, rbacRole, rbacRolePermission } from "@ikyomm/database";
import {
  createDbSelectSchema,
  createListQuerySchema,
  createListResponseSchema,
  optionalBooleanQuerySchema,
} from "@ikyomm/utils";
import z from "zod";

export const rolePermissionActionsSchema = z.record(z.string(), z.boolean());
export const rolePanelSchema = z.enum(["ikyomm", "ommpods", "company", "app"]);
export const roleResourceScopeSchema = z.enum(["ikyomm", "ommpods", "company", "app"]);

export const resourceColumnMetadataSchema = z.object({
  key: z.string(),
  name: z.string(),
  dataType: z.string(),
  columnType: z.string(),
  notNull: z.boolean(),
  hasDefault: z.boolean(),
  enumValues: z.array(z.string()),
});

export const resourceMetadataSchema = z.object({
  resource: z.string(),
  tableName: z.string(),
  label: z.string(),
  scopes: z.array(roleResourceScopeSchema),
  actions: z.array(z.string()),
  columns: z.array(resourceColumnMetadataSchema),
});

export const resourceMetadataListSchema = z.array(resourceMetadataSchema);

export const rolePermissionSchema = createDbSelectSchema(rbacRolePermission).extend({
  actions: rolePermissionActionsSchema,
});

export const roleSchema = createDbSelectSchema(rbacRole);

export const roleWithPermissionsSchema = roleSchema.extend({
  permissions: z.array(rolePermissionSchema),
});

export const roleCreateSchema = z.object({
  name: z.string().min(1, "Name is required"),
  slug: z.string().min(1, "Slug is required").optional(),
  description: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  panel: rolePanelSchema.default("ikyomm"),
  organizationId: z.string().optional().nullable(),
  permissions: z
    .array(
      z.object({
        resource: z.string().min(1, "Resource is required"),
        accessLevel: z.enum(PermissionAccessLevel.enumValues).optional(),
        actions: rolePermissionActionsSchema.optional(),
      })
    )
    .optional(),
});

export const roleUpdateSchema = z
  .object({
    name: z.string().min(1, "Name is required").optional(),
    slug: z.string().min(1, "Slug is required").optional(),
    description: z.string().optional().nullable(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });

export const roleSlugAvailabilityQuerySchema = z.object({
  slug: z.string().trim().min(3, "Enter at least 3 characters."),
  panel: rolePanelSchema.default("ikyomm"),
  organizationId: z.string().optional().nullable(),
});

export const roleSlugAvailabilitySchema = z.object({
  status: z.boolean(),
});

export const rolePermissionCreateSchema = z.object({
  resource: z.string().min(1, "Resource is required"),
  accessLevel: z.enum(PermissionAccessLevel.enumValues).optional(),
  actions: rolePermissionActionsSchema.optional(),
});

export const rolePermissionUpdateSchema = z
  .object({
    resource: z.string().min(1, "Resource is required").optional(),
    accessLevel: z.enum(PermissionAccessLevel.enumValues).optional(),
    actions: rolePermissionActionsSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });

export const roleListQuerySchema = createListQuerySchema({
  sortFields: ["name", "slug", "createdAt", "updatedAt"],
  extraShape: {
    isActive: optionalBooleanQuerySchema,
    panel: rolePanelSchema.optional(),
    organizationId: z.string().trim().optional().nullable(),
  },
});

export type RoleListQuery = z.infer<typeof roleListQuerySchema>;
export type ScopedRoleListQuery = RoleListQuery & {
  panel?: z.infer<typeof rolePanelSchema>;
  organizationId?: string | null;
};

export const roleListResponseSchema = createListResponseSchema(roleWithPermissionsSchema);
