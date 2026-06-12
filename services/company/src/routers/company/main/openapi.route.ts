import {
  createResourceRbacGuards,
  createApiJsonBody,
  createApiSuccessResponse,
  createOpenApiRoute,
  createOperationalRateLimit,
  DEFAULT_FAST_RBAC_AUTH_OPTIONS,
  IdStringParamSchema,
  RBAC_ACTIONS,
} from "@ikyomm/utils";
import { DATABASE_RESOURCES } from "@ikyomm/database";
import {
  companyActionMessageSchema,
  companyCreateResponseSchema,
  companyCreateSchema,
  companyListQuerySchema,
  companyListResponseSchema,
  companyPermanentDeleteResultSchema,
  companySchema,
  companySettingsSchema,
  companyWebsiteDomainAvailabilityQuerySchema,
  companyWebsiteDomainAvailabilitySchema,
  companyUpdateSchema,
} from "./schema";

const tags = ["Company"];

const companyRbac = createResourceRbacGuards({
  resource: DATABASE_RESOURCES.organization,
  auth: {
    ...DEFAULT_FAST_RBAC_AUTH_OPTIONS,
    enableRedisCache: false,
  },
});

const companyMethodsRateLimit = createOperationalRateLimit({
  keyPrefix: "company-methods",
});

export const list = createOpenApiRoute({
  method: "get",
  path: "/list",
  operationId: "companyList",
  tags,
  middleware: [companyMethodsRateLimit, companyRbac.custom("getAll")],
  summary: "List companies",
  request: {
    query: companyListQuerySchema,
  },
  responses: {
    200: createApiSuccessResponse(companyListResponseSchema, "Companies fetched successfully"),
  },
});

export const get = createOpenApiRoute({
  method: "get",
  path: "/{id}",
  operationId: "companyGetById",
  tags,
  middleware: [companyMethodsRateLimit, companyRbac.get],
  summary: "Get a company by ID",
  request: {
    params: IdStringParamSchema(),
  },
  responses: {
    200: createApiSuccessResponse(companySchema, "Company fetched successfully"),
  },
});

export const get_settings = createOpenApiRoute({
  method: "get",
  path: "/{id}/settings",
  operationId: "companyGetSettingsById",
  tags,
  middleware: [companyMethodsRateLimit, companyRbac.get],
  summary: "Get company settings details by ID",
  request: {
    params: IdStringParamSchema(),
  },
  responses: {
    200: createApiSuccessResponse(companySettingsSchema, "Company settings fetched successfully"),
  },
});

export const create = createOpenApiRoute({
  method: "post",
  path: "/",
  operationId: "companyCreate",
  tags,
  middleware: [companyMethodsRateLimit, companyRbac.custom("create")],
  summary: "Create a new company",
  request: {
    body: createApiJsonBody(companyCreateSchema),
  },
  responses: {
    201: createApiSuccessResponse(companyCreateResponseSchema, "Company created successfully"),
  },
});

export const check_website_domain = createOpenApiRoute({
  method: "get",
  path: "/check-website-domain",
  operationId: "companyCheckWebsiteDomainAvailability",
  tags,
  middleware: [companyMethodsRateLimit, companyRbac.custom("create")],
  summary: "Check company website domain availability",
  request: {
    query: companyWebsiteDomainAvailabilityQuerySchema,
  },
  responses: {
    200: createApiSuccessResponse(
      companyWebsiteDomainAvailabilitySchema,
      "Company website domain checked successfully"
    ),
  },
});

export const update = createOpenApiRoute({
  method: "patch",
  path: "/{id}",
  operationId: "companyUpdateById",
  tags,
  middleware: [companyMethodsRateLimit, companyRbac.custom("update")],
  summary: "Update a company by ID",
  request: {
    params: IdStringParamSchema(),
    body: createApiJsonBody(companyUpdateSchema),
  },
  responses: {
    200: createApiSuccessResponse(companySchema, "Company updated successfully"),
  },
});

export const remove = createOpenApiRoute({
  method: "delete",
  path: "/{id}",
  operationId: "companyDeleteById",
  tags,
  middleware: [companyMethodsRateLimit, companyRbac.custom("delete")],
  summary: "Delete a company by ID",
  request: {
    params: IdStringParamSchema(),
  },
  responses: {
    200: createApiSuccessResponse(companySchema, "Company deleted successfully"),
  },
});

export const remove_permanently = createOpenApiRoute({
  method: "delete",
  path: "/{id}/permanent",
  operationId: "companyPermanentDeleteById",
  tags,
  middleware: [companyMethodsRateLimit, companyRbac.custom("delete")],
  summary: "Permanently delete a company with related organization-owned records",
  request: {
    params: IdStringParamSchema(),
  },
  responses: {
    200: createApiSuccessResponse(
      companyPermanentDeleteResultSchema,
      "Company permanently deleted successfully"
    ),
  },
});

export const restore = createOpenApiRoute({
  method: "post",
  path: "/{id}/restore",
  operationId: "companyRestoreById",
  tags,
  middleware: [companyMethodsRateLimit, companyRbac.custom(RBAC_ACTIONS.restore)],
  summary: "Restore a deleted company with related soft-deleted records",
  request: {
    params: IdStringParamSchema(),
  },
  responses: {
    200: createApiSuccessResponse(companySchema, "Company restored successfully"),
  },
});

export const restore_only = createOpenApiRoute({
  method: "post",
  path: "/{id}/restore-only",
  operationId: "companyRestoreOnlyById",
  tags,
  middleware: [companyMethodsRateLimit, companyRbac.custom(RBAC_ACTIONS.restore)],
  summary: "Restore only the deleted company record",
  request: {
    params: IdStringParamSchema(),
  },
  responses: {
    200: createApiSuccessResponse(companySchema, "Company restored successfully"),
  },
});

export const resendCredentials = createOpenApiRoute({
  method: "post",
  path: "/{id}/resend-cred",
  operationId: "companyResendOwnerCredentials",
  tags,
  middleware: [companyMethodsRateLimit, companyRbac.custom("activate")],
  summary: "Resend credentials to the company owner",
  request: {
    params: IdStringParamSchema(),
  },
  responses: {
    200: createApiSuccessResponse(
      companyActionMessageSchema,
      "Company owner credentials resent successfully"
    ),
  },
});
