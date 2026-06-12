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
  ommpodsAgentUserCreateSchema,
  ommpodsAgentUserListQuerySchema,
  ommpodsAgentUserListResponseSchema,
  ommpodsAgentUserPermanentDeleteResultSchema,
  ommpodsAgentUserSchema,
  ommpodsAgentUserSessionListSchema,
  ommpodsAgentUserSessionParamsSchema,
  ommpodsAgentUserSessionRevokeResultSchema,
  ommpodsAgentUserSessionTokenParamsSchema,
  ommpodsAgentUserUpdateSchema,
} from "./schema";

const tags = ["Ikyomm / App Users"];

const ikyommAppUserRbac = createResourceRbacGuards({
  resource: DATABASE_RESOURCES.app_user,
  auth: DEFAULT_FAST_RBAC_AUTH_OPTIONS,
});

const ikyommAppUserMethodsRateLimit = createOperationalRateLimit({
  keyPrefix: "ikyomm-app-user-methods",
});

export const list = createOpenApiRoute({
  method: "get",
  path: "/list",
  operationId: "ikyommAppUserList",
  tags,
  middleware: [ikyommAppUserMethodsRateLimit, ikyommAppUserRbac.custom("getAll")],
  summary: "List Ikyomm app users",
  request: {
    query: ommpodsAgentUserListQuerySchema,
  },
  responses: {
    200: createApiSuccessResponse(
      ommpodsAgentUserListResponseSchema,
      "App users fetched successfully"
    ),
  },
});

export const get = createOpenApiRoute({
  method: "get",
  path: "/{id}",
  operationId: "ikyommAppUserGetById",
  tags,
  middleware: [ikyommAppUserMethodsRateLimit, ikyommAppUserRbac.get],
  summary: "Get an Ikyomm app user by ID",
  request: {
    params: IdStringParamSchema(),
  },
  responses: {
    200: createApiSuccessResponse(ommpodsAgentUserSchema, "App user fetched successfully"),
    404: ApiNotFoundOpenApi,
  },
});

export const create = createOpenApiRoute({
  method: "post",
  path: "/",
  operationId: "ikyommAppUserCreate",
  tags,
  middleware: [ikyommAppUserMethodsRateLimit, ikyommAppUserRbac.custom("create")],
  summary: "Create an Ikyomm app user",
  request: {
    body: createApiJsonBody(ommpodsAgentUserCreateSchema),
  },
  responses: {
    201: createApiSuccessResponse(ommpodsAgentUserSchema, "App user created successfully"),
  },
});

export const update = createOpenApiRoute({
  method: "patch",
  path: "/{id}",
  operationId: "ikyommAppUserUpdateById",
  tags,
  middleware: [ikyommAppUserMethodsRateLimit, ikyommAppUserRbac.custom("update")],
  summary: "Update an Ikyomm app user",
  request: {
    params: IdStringParamSchema(),
    body: createApiJsonBody(ommpodsAgentUserUpdateSchema),
  },
  responses: {
    200: createApiSuccessResponse(ommpodsAgentUserSchema, "App user updated successfully"),
    404: ApiNotFoundOpenApi,
  },
});

export const remove = createOpenApiRoute({
  method: "delete",
  path: "/{id}",
  operationId: "ikyommAppUserDeleteById",
  tags,
  middleware: [ikyommAppUserMethodsRateLimit, ikyommAppUserRbac.custom("delete")],
  summary: "Delete an Ikyomm app user",
  request: {
    params: IdStringParamSchema(),
  },
  responses: {
    200: createApiSuccessResponse(ommpodsAgentUserSchema, "App user deleted successfully"),
    404: ApiNotFoundOpenApi,
  },
});

export const removePermanently = createOpenApiRoute({
  method: "delete",
  path: "/{id}/permanent",
  operationId: "ikyommAppUserPermanentDeleteById",
  tags,
  middleware: [ikyommAppUserMethodsRateLimit, ikyommAppUserRbac.custom("delete")],
  summary: "Permanently delete an Ikyomm app user",
  request: {
    params: IdStringParamSchema(),
  },
  responses: {
    200: createApiSuccessResponse(
      ommpodsAgentUserPermanentDeleteResultSchema,
      "App user permanently deleted successfully"
    ),
    404: ApiNotFoundOpenApi,
  },
});

export const restore = createOpenApiRoute({
  method: "patch",
  path: "/{id}/restore",
  operationId: "ikyommAppUserRestoreById",
  tags,
  middleware: [ikyommAppUserMethodsRateLimit, ikyommAppUserRbac.custom(RBAC_ACTIONS.restore)],
  summary: "Restore an Ikyomm app user",
  request: {
    params: IdStringParamSchema(),
  },
  responses: {
    200: createApiSuccessResponse(ommpodsAgentUserSchema, "App user restored successfully"),
    404: ApiNotFoundOpenApi,
  },
});

export const resendCredentials = createOpenApiRoute({
  method: "post",
  path: "/{id}/resend-cred",
  operationId: "ikyommAppUserResendCredentialsById",
  tags,
  middleware: [ikyommAppUserMethodsRateLimit, ikyommAppUserRbac.custom("activate")],
  summary: "Resend credentials to an Ikyomm app user",
  request: {
    params: IdStringParamSchema(),
  },
  responses: {
    200: createApiSuccessResponse(
      ommpodsAgentUserPermanentDeleteResultSchema,
      "Credentials resent successfully"
    ),
    404: ApiNotFoundOpenApi,
  },
});

export const listSessions = createOpenApiRoute({
  method: "get",
  path: "/{id}/sessions",
  operationId: "ikyommAppUserSessions",
  tags,
  middleware: [ikyommAppUserMethodsRateLimit, ikyommAppUserRbac.custom("get")],
  summary: "List sessions for an Ikyomm app user",
  request: {
    params: ommpodsAgentUserSessionParamsSchema,
  },
  responses: {
    200: createApiSuccessResponse(
      ommpodsAgentUserSessionListSchema,
      "Agent sessions fetched successfully"
    ),
    404: ApiNotFoundOpenApi,
  },
});

export const revokeSession = createOpenApiRoute({
  method: "delete",
  path: "/{id}/sessions/{sessionToken}",
  operationId: "ikyommAppUserRevokeSession",
  tags,
  middleware: [ikyommAppUserMethodsRateLimit, ikyommAppUserRbac.custom("update")],
  summary: "Terminate an Ikyomm app user session",
  request: {
    params: ommpodsAgentUserSessionTokenParamsSchema,
  },
  responses: {
    200: createApiSuccessResponse(
      ommpodsAgentUserSessionRevokeResultSchema,
      "Agent session terminated successfully"
    ),
    404: ApiNotFoundOpenApi,
  },
});

export const revokeAllSessions = createOpenApiRoute({
  method: "delete",
  path: "/{id}/sessions",
  operationId: "ikyommAppUserRevokeAllSessions",
  tags,
  middleware: [ikyommAppUserMethodsRateLimit, ikyommAppUserRbac.custom("update")],
  summary: "Terminate all sessions for an Ikyomm app user",
  request: {
    params: ommpodsAgentUserSessionParamsSchema,
  },
  responses: {
    200: createApiSuccessResponse(
      ommpodsAgentUserSessionRevokeResultSchema,
      "Agent sessions terminated successfully"
    ),
    404: ApiNotFoundOpenApi,
  },
});
