import { DATABASE_RESOURCES } from "@ikyomm/database";
import {
  ApiNotFoundOpenApi,
  createApiJsonBody,
  createApiSuccessResponse,
  createOpenApiRoute,
  createOperationalRateLimit,
  createResourceRbacGuards,
  DEFAULT_FAST_RBAC_AUTH_OPTIONS,
  IdStringParamSchema,
} from "@ikyomm/utils";
import z from "zod";
import {
  roleCreateSchema,
  roleListQuerySchema,
  roleListResponseSchema,
  rolePermissionCreateSchema,
  rolePermissionSchema,
  rolePermissionUpdateSchema,
  roleResourceScopeSchema,
  roleSlugAvailabilityQuerySchema,
  roleSlugAvailabilitySchema,
  resourceMetadataListSchema,
  roleUpdateSchema,
  roleWithPermissionsSchema,
} from "./schema";

const tags = ["Ikyomm / Roles & Permissions"];

const resourceQuerySchema = z.object({
  panel: roleResourceScopeSchema.default("ikyomm"),
});

const roleRbac = createResourceRbacGuards({
  resource: DATABASE_RESOURCES.rbac_role,
  auth: DEFAULT_FAST_RBAC_AUTH_OPTIONS,
});

const permissionRbac = createResourceRbacGuards({
  resource: DATABASE_RESOURCES.rbac_role_permission,
  auth: DEFAULT_FAST_RBAC_AUTH_OPTIONS,
});

const rateLimit = createOperationalRateLimit({
  keyPrefix: "ikyomm-roles-permission-methods",
});

const rolePermissionParamsSchema = z.object({
  roleId: z.string().min(1),
  permissionId: z.string().min(1),
});

export const list = createOpenApiRoute({
  method: "get",
  path: "/list",
  operationId: "ikyommRoleList",
  tags,
  middleware: [rateLimit, roleRbac.custom("getAll")],
  summary: "List Ikyomm roles with permissions",
  request: { query: roleListQuerySchema },
  responses: {
    200: createApiSuccessResponse(roleListResponseSchema, "Roles fetched successfully"),
  },
});

export const resources = createOpenApiRoute({
  method: "get",
  path: "/resources",
  operationId: "ikyommRolePermissionResourceList",
  tags,
  middleware: [rateLimit, roleRbac.custom("getAll")],
  summary: "List Ikyomm RBAC resources with table columns and actions",
  request: { query: resourceQuerySchema },
  responses: {
    200: createApiSuccessResponse(
      resourceMetadataListSchema,
      "RBAC resources fetched successfully"
    ),
  },
});

export const get = createOpenApiRoute({
  method: "get",
  path: "/{id}",
  operationId: "ikyommRoleGetById",
  tags,
  middleware: [rateLimit, roleRbac.get],
  summary: "Get Ikyomm role by ID",
  request: { params: IdStringParamSchema() },
  responses: {
    200: createApiSuccessResponse(roleWithPermissionsSchema, "Role fetched successfully"),
    404: ApiNotFoundOpenApi,
  },
});

export const check_slug = createOpenApiRoute({
  method: "get",
  path: "/check-slug",
  operationId: "ikyommRoleCheckSlugAvailability",
  tags,
  middleware: [rateLimit, roleRbac.custom("create")],
  summary: "Check Ikyomm role slug availability",
  request: { query: roleSlugAvailabilityQuerySchema },
  responses: {
    200: createApiSuccessResponse(roleSlugAvailabilitySchema, "Role slug checked successfully"),
  },
});

export const create = createOpenApiRoute({
  method: "post",
  path: "/",
  operationId: "ikyommRoleCreate",
  tags,
  middleware: [rateLimit, roleRbac.custom("create")],
  summary: "Create an Ikyomm role",
  request: { body: createApiJsonBody(roleCreateSchema) },
  responses: {
    201: createApiSuccessResponse(roleWithPermissionsSchema, "Role created successfully"),
  },
});

export const update = createOpenApiRoute({
  method: "patch",
  path: "/{id}",
  operationId: "ikyommRoleUpdateById",
  tags,
  middleware: [rateLimit, roleRbac.custom("update")],
  summary: "Update an Ikyomm role",
  request: {
    params: IdStringParamSchema(),
    body: createApiJsonBody(roleUpdateSchema),
  },
  responses: {
    200: createApiSuccessResponse(roleWithPermissionsSchema, "Role updated successfully"),
    404: ApiNotFoundOpenApi,
  },
});

export const remove = createOpenApiRoute({
  method: "delete",
  path: "/{id}",
  operationId: "ikyommRoleDeleteById",
  tags,
  middleware: [rateLimit, roleRbac.custom("delete")],
  summary: "Delete an Ikyomm role",
  request: { params: IdStringParamSchema() },
  responses: {
    200: createApiSuccessResponse(roleWithPermissionsSchema, "Role deleted successfully"),
    404: ApiNotFoundOpenApi,
  },
});

export const create_permission = createOpenApiRoute({
  method: "post",
  path: "/{id}/permissions",
  operationId: "ikyommRolePermissionCreate",
  tags,
  middleware: [rateLimit, permissionRbac.custom("create")],
  summary: "Create a permission for an Ikyomm role",
  request: {
    params: IdStringParamSchema(),
    body: createApiJsonBody(rolePermissionCreateSchema),
  },
  responses: {
    201: createApiSuccessResponse(rolePermissionSchema, "Permission created successfully"),
    404: ApiNotFoundOpenApi,
  },
});

export const update_permission = createOpenApiRoute({
  method: "patch",
  path: "/{roleId}/permissions/{permissionId}",
  operationId: "ikyommRolePermissionUpdateById",
  tags,
  middleware: [rateLimit, permissionRbac.custom("update")],
  summary: "Update an Ikyomm role permission",
  request: {
    params: rolePermissionParamsSchema,
    body: createApiJsonBody(rolePermissionUpdateSchema),
  },
  responses: {
    200: createApiSuccessResponse(rolePermissionSchema, "Permission updated successfully"),
    404: ApiNotFoundOpenApi,
  },
});

export const remove_permission = createOpenApiRoute({
  method: "delete",
  path: "/{roleId}/permissions/{permissionId}",
  operationId: "ikyommRolePermissionDeleteById",
  tags,
  middleware: [rateLimit, permissionRbac.custom("delete")],
  summary: "Delete an Ikyomm role permission",
  request: { params: rolePermissionParamsSchema },
  responses: {
    200: createApiSuccessResponse(rolePermissionSchema, "Permission deleted successfully"),
    404: ApiNotFoundOpenApi,
  },
});
