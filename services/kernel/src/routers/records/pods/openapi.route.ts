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
  podCreateSchema,
  podDeleteResponseSchema,
  podListQuerySchema,
  podListResponseSchema,
  podSchema,
  podUpdateSchema,
} from "./schema";

const tags = ["Records / Pods"];

const podsRbac = createResourceRbacGuards({
  resource: DATABASE_RESOURCES.pods,
  auth: {
    ...DEFAULT_FAST_RBAC_AUTH_OPTIONS,
    enableRedisCache: false,
  },
});

const recordMethodsRateLimit = createOperationalRateLimit({
  keyPrefix: "records-pods-methods",
});

export const list = createOpenApiRoute({
  method: "get",
  path: "/list",
  operationId: "podList",
  tags,
  middleware: [recordMethodsRateLimit, podsRbac.custom("getAll")],
  summary: "List Pods records",
  request: {
    query: podListQuerySchema,
  },
  responses: {
    200: createApiSuccessResponse(podListResponseSchema, "Pods fetched successfully"),
  },
});

export const get = createOpenApiRoute({
  method: "get",
  path: "/{id}",
  operationId: "podGetById",
  tags,
  middleware: [recordMethodsRateLimit, podsRbac.custom("get")],
  summary: "Get an Pod by ID",
  request: {
    params: IdStringParamSchema(),
  },
  responses: {
    200: createApiSuccessResponse(podSchema, "Pod fetched successfully"),
  },
});

export const create = createOpenApiRoute({
  method: "post",
  path: "/",
  operationId: "podCreate",
  tags,
  middleware: [recordMethodsRateLimit, podsRbac.custom("create")],
  summary: "Create an Pod record",
  description: "Create an Pod record with optional connected device configuration entries.",
  request: {
    body: createApiJsonBody(podCreateSchema),
  },
  responses: {
    201: createApiSuccessResponse(podSchema, "Pod created successfully"),
  },
});

export const update = createOpenApiRoute({
  method: "patch",
  path: "/{id}",
  operationId: "podUpdateById",
  tags,
  middleware: [recordMethodsRateLimit, podsRbac.custom("update")],
  summary: "Update an Pod record",
  description: "Update an Pod record and its connected device configuration entries.",
  request: {
    params: IdStringParamSchema(),
    body: createApiJsonBody(podUpdateSchema),
  },
  responses: {
    200: createApiSuccessResponse(podSchema, "Pod updated successfully"),
  },
});

export const remove = createOpenApiRoute({
  method: "delete",
  path: "/{id}",
  operationId: "podDeleteById",
  tags,
  middleware: [recordMethodsRateLimit, podsRbac.custom("delete")],
  summary: "Soft delete an Pod record",
  request: {
    params: IdStringParamSchema(),
  },
  responses: {
    200: createApiSuccessResponse(podDeleteResponseSchema, "Pod deleted successfully"),
  },
});

export const permanentRemove = createOpenApiRoute({
  method: "delete",
  path: "/{id}/permanent",
  operationId: "podPermanentDeleteById",
  tags,
  middleware: [recordMethodsRateLimit, podsRbac.custom("delete")],
  summary: "Permanently delete an Pod record",
  request: {
    params: IdStringParamSchema(),
  },
  responses: {
    200: createApiSuccessResponse(podDeleteResponseSchema, "Pod permanently deleted successfully"),
  },
});

export const restore = createOpenApiRoute({
  method: "patch",
  path: "/{id}/restore",
  operationId: "podRestoreById",
  tags,
  middleware: [recordMethodsRateLimit, podsRbac.custom(RBAC_ACTIONS.restore)],
  summary: "Restore a soft-deleted Pod record",
  request: {
    params: IdStringParamSchema(),
  },
  responses: {
    200: createApiSuccessResponse(podDeleteResponseSchema, "Pod restored successfully"),
  },
});
