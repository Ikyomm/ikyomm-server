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
  musicCreateSchema,
  musicDeleteResponseSchema,
  musicListQuerySchema,
  musicListResponseSchema,
  musicSchema,
  musicUpdateSchema,
} from "./schema";

const tags = ["Records / Musics"];

const musicsRbac = createResourceRbacGuards({
  resource: DATABASE_RESOURCES.musics,
  auth: {
    ...DEFAULT_FAST_RBAC_AUTH_OPTIONS,
    enableRedisCache: false,
  },
});

const recordMethodsRateLimit = createOperationalRateLimit({
  keyPrefix: "records-musics-methods",
});

export const list = createOpenApiRoute({
  method: "get",
  path: "/list",
  operationId: "musicList",
  tags,
  middleware: [recordMethodsRateLimit, musicsRbac.custom("getAll")],
  summary: "List music records",
  request: {
    query: musicListQuerySchema,
  },
  responses: {
    200: createApiSuccessResponse(musicListResponseSchema, "Musics fetched successfully"),
  },
});

export const get = createOpenApiRoute({
  method: "get",
  path: "/{id}",
  operationId: "musicGetById",
  tags,
  middleware: [recordMethodsRateLimit, musicsRbac.custom("get")],
  summary: "Get a music by ID",
  request: {
    params: IdStringParamSchema(),
  },
  responses: {
    200: createApiSuccessResponse(musicSchema, "Music fetched successfully"),
  },
});

export const create = createOpenApiRoute({
  method: "post",
  path: "/",
  operationId: "musicCreate",
  tags,
  middleware: [recordMethodsRateLimit, musicsRbac.custom("create")],
  summary: "Create a music record",
  request: {
    body: createApiJsonBody(musicCreateSchema),
  },
  responses: {
    201: createApiSuccessResponse(musicSchema, "Music created successfully"),
  },
});

export const update = createOpenApiRoute({
  method: "patch",
  path: "/{id}",
  operationId: "musicUpdateById",
  tags,
  middleware: [recordMethodsRateLimit, musicsRbac.custom("update")],
  summary: "Update a music record",
  request: {
    params: IdStringParamSchema(),
    body: createApiJsonBody(musicUpdateSchema),
  },
  responses: {
    200: createApiSuccessResponse(musicSchema, "Music updated successfully"),
  },
});

export const remove = createOpenApiRoute({
  method: "delete",
  path: "/{id}",
  operationId: "musicDeleteById",
  tags,
  middleware: [recordMethodsRateLimit, musicsRbac.custom("delete")],
  summary: "Soft delete a music record",
  request: {
    params: IdStringParamSchema(),
  },
  responses: {
    200: createApiSuccessResponse(musicDeleteResponseSchema, "Music deleted successfully"),
  },
});

export const permanentRemove = createOpenApiRoute({
  method: "delete",
  path: "/{id}/permanent",
  operationId: "musicPermanentDeleteById",
  tags,
  middleware: [recordMethodsRateLimit, musicsRbac.custom("delete")],
  summary: "Permanently delete a music record",
  request: {
    params: IdStringParamSchema(),
  },
  responses: {
    200: createApiSuccessResponse(
      musicDeleteResponseSchema,
      "Music permanently deleted successfully"
    ),
  },
});

export const restore = createOpenApiRoute({
  method: "patch",
  path: "/{id}/restore",
  operationId: "musicRestoreById",
  tags,
  middleware: [recordMethodsRateLimit, musicsRbac.custom(RBAC_ACTIONS.restore)],
  summary: "Restore a soft-deleted music record",
  request: {
    params: IdStringParamSchema(),
  },
  responses: {
    200: createApiSuccessResponse(musicDeleteResponseSchema, "Music restored successfully"),
  },
});
