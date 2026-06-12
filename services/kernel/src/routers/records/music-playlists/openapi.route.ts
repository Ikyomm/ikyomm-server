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
  musicPlaylistCreateSchema,
  musicPlaylistDeleteResponseSchema,
  musicPlaylistListQuerySchema,
  musicPlaylistListResponseSchema,
  musicPlaylistSchema,
  musicPlaylistUpdateSchema,
} from "./schema";

const tags = ["Records / Music Playlists"];

const musicPlaylistsRbac = createResourceRbacGuards({
  resource: DATABASE_RESOURCES.music_playlists,
  auth: {
    ...DEFAULT_FAST_RBAC_AUTH_OPTIONS,
    enableRedisCache: false,
  },
});

const recordMethodsRateLimit = createOperationalRateLimit({
  keyPrefix: "records-music-playlists-methods",
});

export const list = createOpenApiRoute({
  method: "get",
  path: "/list",
  operationId: "musicPlaylistList",
  tags,
  middleware: [recordMethodsRateLimit, musicPlaylistsRbac.custom("getAll")],
  summary: "List music playlist records",
  request: {
    query: musicPlaylistListQuerySchema,
  },
  responses: {
    200: createApiSuccessResponse(
      musicPlaylistListResponseSchema,
      "Music playlists fetched successfully"
    ),
  },
});

export const get = createOpenApiRoute({
  method: "get",
  path: "/{id}",
  operationId: "musicPlaylistGetById",
  tags,
  middleware: [recordMethodsRateLimit, musicPlaylistsRbac.custom("get")],
  summary: "Get a music playlist by ID",
  request: {
    params: IdStringParamSchema(),
  },
  responses: {
    200: createApiSuccessResponse(musicPlaylistSchema, "Music playlist fetched successfully"),
  },
});

export const create = createOpenApiRoute({
  method: "post",
  path: "/",
  operationId: "musicPlaylistCreate",
  tags,
  middleware: [recordMethodsRateLimit, musicPlaylistsRbac.custom("create")],
  summary: "Create a music playlist record",
  request: {
    body: createApiJsonBody(musicPlaylistCreateSchema),
  },
  responses: {
    201: createApiSuccessResponse(musicPlaylistSchema, "Music playlist created successfully"),
  },
});

export const update = createOpenApiRoute({
  method: "patch",
  path: "/{id}",
  operationId: "musicPlaylistUpdateById",
  tags,
  middleware: [recordMethodsRateLimit, musicPlaylistsRbac.custom("update")],
  summary: "Update a music playlist record",
  request: {
    params: IdStringParamSchema(),
    body: createApiJsonBody(musicPlaylistUpdateSchema),
  },
  responses: {
    200: createApiSuccessResponse(musicPlaylistSchema, "Music playlist updated successfully"),
  },
});

export const remove = createOpenApiRoute({
  method: "delete",
  path: "/{id}",
  operationId: "musicPlaylistDeleteById",
  tags,
  middleware: [recordMethodsRateLimit, musicPlaylistsRbac.custom("delete")],
  summary: "Soft delete a music playlist record",
  request: {
    params: IdStringParamSchema(),
  },
  responses: {
    200: createApiSuccessResponse(
      musicPlaylistDeleteResponseSchema,
      "Music playlist deleted successfully"
    ),
  },
});

export const permanentRemove = createOpenApiRoute({
  method: "delete",
  path: "/{id}/permanent",
  operationId: "musicPlaylistPermanentDeleteById",
  tags,
  middleware: [recordMethodsRateLimit, musicPlaylistsRbac.custom("delete")],
  summary: "Permanently delete a music playlist record",
  request: {
    params: IdStringParamSchema(),
  },
  responses: {
    200: createApiSuccessResponse(
      musicPlaylistDeleteResponseSchema,
      "Music playlist permanently deleted successfully"
    ),
  },
});

export const restore = createOpenApiRoute({
  method: "patch",
  path: "/{id}/restore",
  operationId: "musicPlaylistRestoreById",
  tags,
  middleware: [recordMethodsRateLimit, musicPlaylistsRbac.custom(RBAC_ACTIONS.restore)],
  summary: "Restore a soft-deleted music playlist record",
  request: {
    params: IdStringParamSchema(),
  },
  responses: {
    200: createApiSuccessResponse(
      musicPlaylistDeleteResponseSchema,
      "Music playlist restored successfully"
    ),
  },
});
