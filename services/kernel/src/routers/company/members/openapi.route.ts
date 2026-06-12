import {
  ApiNotFoundOpenApi,
  createResourceRbacGuards,
  createApiJsonBody,
  createApiSuccessResponse,
  createOpenApiRoute,
  createOperationalRateLimit,
  DEFAULT_FAST_RBAC_AUTH_OPTIONS,
  IdStringParamSchema,
} from "@ikyomm/utils";
import { DATABASE_RESOURCES } from "@ikyomm/database";
import {
  memberBanSchema,
  memberCreateSchema,
  memberDeleteWithUserResultSchema,
  memberListItemSchema,
  memberListParamsSchema,
  memberListQuerySchema,
  memberListResponseSchema,
  memberRemoveResultSchema,
  memberSchema,
  memberUpdateSchema,
} from "./schema";

const tags = ["Company / Members"];

const memberRbac = createResourceRbacGuards({
  resource: DATABASE_RESOURCES.member,
  auth: {
    ...DEFAULT_FAST_RBAC_AUTH_OPTIONS,
    enableRedisCache: false,
  },
});

const companyMethodsRateLimit = createOperationalRateLimit({
  keyPrefix: "company-member-methods",
});

export const list = createOpenApiRoute({
  method: "get",
  path: "/{companyId}/list",
  operationId: "companyMemberList",
  tags,
  middleware: [companyMethodsRateLimit, memberRbac.custom("getAll")],
  summary: "List company members",
  request: {
    params: memberListParamsSchema,
    query: memberListQuerySchema,
  },
  responses: {
    200: createApiSuccessResponse(memberListResponseSchema, "Members fetched successfully"),
  },
});

export const globalList = createOpenApiRoute({
  method: "get",
  path: "/list",
  operationId: "companyMemberGlobalList",
  tags,
  middleware: [companyMethodsRateLimit, memberRbac.custom("getAll")],
  summary: "List members across companies",
  request: {
    query: memberListQuerySchema,
  },
  responses: {
    200: createApiSuccessResponse(memberListResponseSchema, "Members fetched successfully"),
  },
});

export const get = createOpenApiRoute({
  method: "get",
  path: "/{id}",
  operationId: "companyMemberGetById",
  tags,
  middleware: [companyMethodsRateLimit, memberRbac.get],
  summary: "Get a company member by ID",
  request: {
    params: IdStringParamSchema(),
  },
  responses: {
    200: createApiSuccessResponse(memberListItemSchema, "Member fetched successfully"),
    404: ApiNotFoundOpenApi,
  },
});

export const create = createOpenApiRoute({
  method: "post",
  path: "/",
  operationId: "companyMemberCreate",
  tags,
  middleware: [companyMethodsRateLimit, memberRbac.custom("create")],
  summary: "Add a new member to the company",
  request: {
    body: createApiJsonBody(memberCreateSchema),
  },
  responses: {
    201: createApiSuccessResponse(memberSchema, "Member created successfully"),
  },
});

export const update = createOpenApiRoute({
  method: "patch",
  path: "/{id}",
  operationId: "companyMemberUpdateById",
  tags,
  middleware: [companyMethodsRateLimit, memberRbac.custom("update")],
  summary: "Update an existing member",
  request: {
    params: IdStringParamSchema(),
    body: createApiJsonBody(memberUpdateSchema),
  },
  responses: {
    200: createApiSuccessResponse(memberSchema, "Member updated successfully"),
  },
});

export const remove = createOpenApiRoute({
  method: "delete",
  path: "/{id}/remove",
  operationId: "companyMemberRemoveById",
  tags,
  middleware: [companyMethodsRateLimit, memberRbac.custom("delete")],
  summary: "Remove a member from the company and keep the linked user account",
  request: {
    params: IdStringParamSchema(),
  },
  responses: {
    200: createApiSuccessResponse(memberRemoveResultSchema, "Member removed successfully"),
  },
});

export const softDelete = createOpenApiRoute({
  method: "delete",
  path: "/{id}",
  operationId: "companyMemberDeleteById",
  tags,
  middleware: [companyMethodsRateLimit, memberRbac.custom("delete")],
  summary: "Soft delete a company member",
  request: {
    params: IdStringParamSchema(),
  },
  responses: {
    200: createApiSuccessResponse(memberSchema, "Member deleted successfully"),
  },
});

export const remove_with_user = createOpenApiRoute({
  method: "delete",
  path: "/{id}/with-user",
  operationId: "companyMemberDeleteWithUserById",
  tags,
  middleware: [companyMethodsRateLimit, memberRbac.custom("delete")],
  summary: "Remove a member and their user account also",
  request: {
    params: IdStringParamSchema(),
  },
  responses: {
    200: createApiSuccessResponse(
      memberDeleteWithUserResultSchema,
      "Member with user removed successfully"
    ),
  },
});

export const ban = createOpenApiRoute({
  method: "post",
  path: "/{id}/ban",
  operationId: "companyMemberBanById",
  tags,
  middleware: [companyMethodsRateLimit, memberRbac.custom("deactivate")],
  summary: "Ban a company member user account",
  request: {
    params: IdStringParamSchema(),
    body: createApiJsonBody(memberBanSchema),
  },
  responses: {
    200: createApiSuccessResponse(memberListItemSchema, "Member banned successfully"),
    404: ApiNotFoundOpenApi,
  },
});

export const resendCredentials = createOpenApiRoute({
  method: "post",
  path: "/{id}/resend-cred",
  operationId: "companyMemberResendCredentialsById",
  tags,
  middleware: [companyMethodsRateLimit, memberRbac.custom("activate")],
  summary: "Resend credentials to a member",
  request: {
    params: IdStringParamSchema(),
  },
  responses: {
    200: createApiSuccessResponse(
      memberDeleteWithUserResultSchema,
      "Credentials resent successfully"
    ),
    404: ApiNotFoundOpenApi,
  },
});
