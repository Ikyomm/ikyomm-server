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
import { DATABASE_RESOURCES } from "@ikyomm/database";
import {
  podMoodPresetCreateSchema,
  podMoodPresetDeleteResponseSchema,
  podMoodPresetListQuerySchema,
  podMoodPresetListResponseSchema,
  podMoodPresetSchema,
  podMoodPresetUpdateSchema,
} from "./schema";

const tags = ["Records / Mood Presets"];

const moodPresetsRbac = createResourceRbacGuards({
  resource: DATABASE_RESOURCES.pod_mood_presets,
  auth: {
    ...DEFAULT_FAST_RBAC_AUTH_OPTIONS,
    enableRedisCache: false,
  },
});

const recordMethodsRateLimit = createOperationalRateLimit({
  keyPrefix: "records-mood-presets-methods",
});

export const list = createOpenApiRoute({
  method: "get",
  path: "/list",
  operationId: "podMoodPresetList",
  tags,
  middleware: [recordMethodsRateLimit],
  summary: "List Pod mood preset records",
  request: {
    query: podMoodPresetListQuerySchema,
  },
  responses: {
    200: createApiSuccessResponse(
      podMoodPresetListResponseSchema,
      "Mood presets fetched successfully"
    ),
  },
});

export const get = createOpenApiRoute({
  method: "get",
  path: "/{id}",
  operationId: "podMoodPresetGetById",
  tags,
  middleware: [recordMethodsRateLimit],
  summary: "Get a Pod mood preset by ID",
  request: {
    params: IdStringParamSchema(),
  },
  responses: {
    200: createApiSuccessResponse(podMoodPresetSchema, "Mood preset fetched successfully"),
  },
});

export const create = createOpenApiRoute({
  method: "post",
  path: "/",
  operationId: "podMoodPresetCreate",
  tags,
  middleware: [recordMethodsRateLimit, moodPresetsRbac.custom("create")],
  summary: "Create a Pod mood preset record",
  request: {
    body: createApiJsonBody(podMoodPresetCreateSchema),
  },
  responses: {
    201: createApiSuccessResponse(podMoodPresetSchema, "Mood preset created successfully"),
  },
});

export const update = createOpenApiRoute({
  method: "patch",
  path: "/{id}",
  operationId: "podMoodPresetUpdateById",
  tags,
  middleware: [recordMethodsRateLimit, moodPresetsRbac.custom("update")],
  summary: "Update a Pod mood preset record",
  request: {
    params: IdStringParamSchema(),
    body: createApiJsonBody(podMoodPresetUpdateSchema),
  },
  responses: {
    200: createApiSuccessResponse(podMoodPresetSchema, "Mood preset updated successfully"),
  },
});

export const remove = createOpenApiRoute({
  method: "delete",
  path: "/{id}",
  operationId: "podMoodPresetDeleteById",
  tags,
  middleware: [recordMethodsRateLimit, moodPresetsRbac.custom("delete")],
  summary: "Soft delete a Pod mood preset record",
  request: {
    params: IdStringParamSchema(),
  },
  responses: {
    200: createApiSuccessResponse(
      podMoodPresetDeleteResponseSchema,
      "Mood preset deleted successfully"
    ),
  },
});

export const permanentRemove = createOpenApiRoute({
  method: "delete",
  path: "/{id}/permanent",
  operationId: "podMoodPresetPermanentDeleteById",
  tags,
  middleware: [recordMethodsRateLimit, moodPresetsRbac.custom("delete")],
  summary: "Permanently delete a Pod mood preset record",
  request: {
    params: IdStringParamSchema(),
  },
  responses: {
    200: createApiSuccessResponse(
      podMoodPresetDeleteResponseSchema,
      "Mood preset permanently deleted successfully"
    ),
  },
});

export const restore = createOpenApiRoute({
  method: "patch",
  path: "/{id}/restore",
  operationId: "podMoodPresetRestoreById",
  tags,
  middleware: [recordMethodsRateLimit, moodPresetsRbac.custom(RBAC_ACTIONS.restore)],
  summary: "Restore a soft-deleted Pod mood preset record",
  request: {
    params: IdStringParamSchema(),
  },
  responses: {
    200: createApiSuccessResponse(
      podMoodPresetDeleteResponseSchema,
      "Mood preset restored successfully"
    ),
  },
});
