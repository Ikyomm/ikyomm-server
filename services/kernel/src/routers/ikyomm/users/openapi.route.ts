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
  RBAC_ACTIONS,
} from "@ikyomm/utils";
import {
  ommpodsUserCreateSchema,
  ommpodsUserListQuerySchema,
  ommpodsUserListResponseSchema,
  ommpodsUserPermanentDeleteResultSchema,
  ommpodsUserSchema,
  ommpodsUserSessionListSchema,
  ommpodsUserSessionParamsSchema,
  ommpodsUserSessionRevokeResultSchema,
  ommpodsUserSessionTokenParamsSchema,
  ommpodsUserUpdateSchema,
} from "./schema";

const tags = ["Ikyomm / Users"];

const ikyommUserRbac = createResourceRbacGuards({
  resource: DATABASE_RESOURCES.user,
  auth: DEFAULT_FAST_RBAC_AUTH_OPTIONS,
});

const ikyommUserMethodsRateLimit = createOperationalRateLimit({
  keyPrefix: "ikyomm-user-methods",
});

export const list = createOpenApiRoute({
  method: "get",
  path: "/list",
  operationId: "ikyommUserList",
  tags,
  middleware: [ikyommUserMethodsRateLimit, ikyommUserRbac.custom("getAll")],
  summary: "List Ikyomm users",
  request: {
    query: ommpodsUserListQuerySchema,
  },
  responses: {
    200: createApiSuccessResponse(ommpodsUserListResponseSchema, "Users fetched successfully"),
  },
});

export const get = createOpenApiRoute({
  method: "get",
  path: "/{id}",
  operationId: "ikyommUserGetById",
  tags,
  middleware: [ikyommUserMethodsRateLimit, ikyommUserRbac.get],
  summary: "Get an Ikyomm user by ID",
  request: {
    params: IdStringParamSchema(),
  },
  responses: {
    200: createApiSuccessResponse(ommpodsUserSchema, "User fetched successfully"),
    404: ApiNotFoundOpenApi,
  },
});

export const create = createOpenApiRoute({
  method: "post",
  path: "/",
  operationId: "ikyommUserCreate",
  tags,
  middleware: [ikyommUserMethodsRateLimit, ikyommUserRbac.custom("create")],
  summary: "Create an Ikyomm user",
  request: {
    body: createApiJsonBody(ommpodsUserCreateSchema),
  },
  responses: {
    201: createApiSuccessResponse(ommpodsUserSchema, "User created successfully"),
  },
});

export const update = createOpenApiRoute({
  method: "patch",
  path: "/{id}",
  operationId: "ikyommUserUpdateById",
  tags,
  middleware: [ikyommUserMethodsRateLimit, ikyommUserRbac.custom("update")],
  summary: "Update an Ikyomm user",
  request: {
    params: IdStringParamSchema(),
    body: createApiJsonBody(ommpodsUserUpdateSchema),
  },
  responses: {
    200: createApiSuccessResponse(ommpodsUserSchema, "User updated successfully"),
    404: ApiNotFoundOpenApi,
  },
});

export const remove = createOpenApiRoute({
  method: "delete",
  path: "/{id}",
  operationId: "ikyommUserDeleteById",
  tags,
  middleware: [ikyommUserMethodsRateLimit, ikyommUserRbac.custom("delete")],
  summary: "Delete an Ikyomm user",
  request: {
    params: IdStringParamSchema(),
  },
  responses: {
    200: createApiSuccessResponse(ommpodsUserSchema, "User deleted successfully"),
    404: ApiNotFoundOpenApi,
  },
});

export const removePermanently = createOpenApiRoute({
  method: "delete",
  path: "/{id}/permanent",
  operationId: "ikyommUserPermanentDeleteById",
  tags,
  middleware: [ikyommUserMethodsRateLimit, ikyommUserRbac.custom("delete")],
  summary: "Permanently delete an Ikyomm user",
  request: {
    params: IdStringParamSchema(),
  },
  responses: {
    200: createApiSuccessResponse(
      ommpodsUserPermanentDeleteResultSchema,
      "User permanently deleted successfully"
    ),
    404: ApiNotFoundOpenApi,
  },
});

export const restore = createOpenApiRoute({
  method: "patch",
  path: "/{id}/restore",
  operationId: "ikyommUserRestoreById",
  tags,
  middleware: [ikyommUserMethodsRateLimit, ikyommUserRbac.custom(RBAC_ACTIONS.restore)],
  summary: "Restore an Ikyomm user",
  request: {
    params: IdStringParamSchema(),
  },
  responses: {
    200: createApiSuccessResponse(ommpodsUserSchema, "User restored successfully"),
    404: ApiNotFoundOpenApi,
  },
});

export const resendCredentials = createOpenApiRoute({
  method: "post",
  path: "/{id}/resend-cred",
  operationId: "ikyommUserResendCredentialsById",
  tags,
  middleware: [ikyommUserMethodsRateLimit, ikyommUserRbac.custom("activate")],
  summary: "Resend credentials to an Ikyomm user",
  request: {
    params: IdStringParamSchema(),
  },
  responses: {
    200: createApiSuccessResponse(
      ommpodsUserPermanentDeleteResultSchema,
      "Credentials resent successfully"
    ),
    404: ApiNotFoundOpenApi,
  },
});

export const listSessions = createOpenApiRoute({
  method: "get",
  path: "/{id}/sessions",
  operationId: "ikyommUserSessions",
  tags,
  middleware: [ikyommUserMethodsRateLimit, ikyommUserRbac.custom("get")],
  summary: "List sessions for an Ikyomm user",
  request: {
    params: ommpodsUserSessionParamsSchema,
  },
  responses: {
    200: createApiSuccessResponse(
      ommpodsUserSessionListSchema,
      "User sessions fetched successfully"
    ),
    404: ApiNotFoundOpenApi,
  },
});

export const revokeSession = createOpenApiRoute({
  method: "delete",
  path: "/{id}/sessions/{sessionToken}",
  operationId: "ikyommUserRevokeSession",
  tags,
  middleware: [ikyommUserMethodsRateLimit, ikyommUserRbac.custom("update")],
  summary: "Terminate an Ikyomm user session",
  request: {
    params: ommpodsUserSessionTokenParamsSchema,
  },
  responses: {
    200: createApiSuccessResponse(
      ommpodsUserSessionRevokeResultSchema,
      "User session terminated successfully"
    ),
    404: ApiNotFoundOpenApi,
  },
});

export const revokeAllSessions = createOpenApiRoute({
  method: "delete",
  path: "/{id}/sessions",
  operationId: "ikyommUserRevokeAllSessions",
  tags,
  middleware: [ikyommUserMethodsRateLimit, ikyommUserRbac.custom("update")],
  summary: "Terminate all sessions for an Ikyomm user",
  request: {
    params: ommpodsUserSessionParamsSchema,
  },
  responses: {
    200: createApiSuccessResponse(
      ommpodsUserSessionRevokeResultSchema,
      "User sessions terminated successfully"
    ),
    404: ApiNotFoundOpenApi,
  },
});
