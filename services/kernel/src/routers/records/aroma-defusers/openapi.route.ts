import { DATABASE_RESOURCES } from "@ikyomm/database";
import {
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
  aromaDefuserCreateSchema,
  aromaDefuserDeleteResponseSchema,
  aromaDefuserListQuerySchema,
  aromaDefuserListResponseSchema,
  aromaDefuserSchema,
  aromaDefuserUpdateSchema,
} from "./schema";

const tags = ["Records / Aroma Defusers"];

const aromaDefuserRbac = createResourceRbacGuards({
  resource: DATABASE_RESOURCES.aroma_defuser,
  auth: {
    ...DEFAULT_FAST_RBAC_AUTH_OPTIONS,
    enableRedisCache: false,
  },
});

const recordMethodsRateLimit = createOperationalRateLimit({
  keyPrefix: "records-aroma-defusers-methods",
});

export const list = createOpenApiRoute({
  method: "get",
  path: "/list",
  operationId: "aromaDefuserList",
  tags,
  middleware: [recordMethodsRateLimit, aromaDefuserRbac.custom("getAll")],
  summary: "List Aroma Defuser records",
  request: {
    query: aromaDefuserListQuerySchema,
  },
  responses: {
    200: createApiSuccessResponse(
      aromaDefuserListResponseSchema,
      "Aroma Defusers fetched successfully"
    ),
  },
});

export const get = createOpenApiRoute({
  method: "get",
  path: "/{id}",
  operationId: "aromaDefuserGetById",
  tags,
  middleware: [recordMethodsRateLimit, aromaDefuserRbac.custom("get")],
  summary: "Get an Aroma Defuser by ID",
  request: {
    params: IdStringParamSchema(),
  },
  responses: {
    200: createApiSuccessResponse(aromaDefuserSchema, "Aroma Defuser fetched successfully"),
  },
});

export const create = createOpenApiRoute({
  method: "post",
  path: "/",
  operationId: "aromaDefuserCreate",
  tags,
  middleware: [recordMethodsRateLimit, aromaDefuserRbac.custom("create")],
  summary: "Create an Aroma Defuser record",
  request: {
    body: createApiJsonBody(aromaDefuserCreateSchema),
  },
  responses: {
    201: createApiSuccessResponse(aromaDefuserSchema, "Aroma Defuser created successfully"),
  },
});

export const update = createOpenApiRoute({
  method: "patch",
  path: "/{id}",
  operationId: "aromaDefuserUpdateById",
  tags,
  middleware: [recordMethodsRateLimit, aromaDefuserRbac.custom("update")],
  summary: "Update an Aroma Defuser record",
  request: {
    params: IdStringParamSchema(),
    body: createApiJsonBody(aromaDefuserUpdateSchema),
  },
  responses: {
    200: createApiSuccessResponse(aromaDefuserSchema, "Aroma Defuser updated successfully"),
  },
});

export const remove = createOpenApiRoute({
  method: "delete",
  path: "/{id}",
  operationId: "aromaDefuserDeleteById",
  tags,
  middleware: [recordMethodsRateLimit, aromaDefuserRbac.custom("delete")],
  summary: "Soft delete an Aroma Defuser record",
  request: {
    params: IdStringParamSchema(),
  },
  responses: {
    200: createApiSuccessResponse(
      aromaDefuserDeleteResponseSchema,
      "Aroma Defuser deleted successfully"
    ),
  },
});

export const permanentRemove = createOpenApiRoute({
  method: "delete",
  path: "/{id}/permanent",
  operationId: "aromaDefuserPermanentDeleteById",
  tags,
  middleware: [recordMethodsRateLimit, aromaDefuserRbac.custom("delete")],
  summary: "Permanently delete an Aroma Defuser record",
  request: {
    params: IdStringParamSchema(),
  },
  responses: {
    200: createApiSuccessResponse(
      aromaDefuserDeleteResponseSchema,
      "Aroma Defuser permanently deleted successfully"
    ),
  },
});

export const restore = createOpenApiRoute({
  method: "patch",
  path: "/{id}/restore",
  operationId: "aromaDefuserRestoreById",
  tags,
  middleware: [recordMethodsRateLimit, aromaDefuserRbac.custom(RBAC_ACTIONS.restore)],
  summary: "Restore a soft-deleted Aroma Defuser record",
  request: {
    params: IdStringParamSchema(),
  },
  responses: {
    200: createApiSuccessResponse(
      aromaDefuserDeleteResponseSchema,
      "Aroma Defuser restored successfully"
    ),
  },
});
