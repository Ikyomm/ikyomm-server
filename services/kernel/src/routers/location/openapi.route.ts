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
  locationCreateSchema,
  locationGetQuerySchema,
  locationListQuerySchema,
  locationListResponseSchema,
  locationSchema,
  locationUpdateSchema,
  locationWithZoneSchema,
  regionCreateSchema,
  regionGetQuerySchema,
  regionListQuerySchema,
  regionListResponseSchema,
  regionSchema,
  regionUpdateSchema,
  regionWithZonesSchema,
  zoneCreateSchema,
  zoneGetQuerySchema,
  zoneListQuerySchema,
  zoneListResponseSchema,
  zoneSchema,
  zoneUpdateSchema,
  zoneWithRegionSchema,
} from "./schema";

const locationMethodsRateLimit = createOperationalRateLimit({
  keyPrefix: "location-methods",
});

const regionRbac = createResourceRbacGuards({
  resource: DATABASE_RESOURCES.region,
  auth: {
    ...DEFAULT_FAST_RBAC_AUTH_OPTIONS,
    enableRedisCache: false,
  },
});

const zoneRbac = createResourceRbacGuards({
  resource: DATABASE_RESOURCES.zone,
  auth: {
    ...DEFAULT_FAST_RBAC_AUTH_OPTIONS,
    enableRedisCache: false,
  },
});

const locationRbac = createResourceRbacGuards({
  resource: DATABASE_RESOURCES.zone_location,
  auth: {
    ...DEFAULT_FAST_RBAC_AUTH_OPTIONS,
    enableRedisCache: false,
  },
});

export const listRegions = createOpenApiRoute({
  method: "get",
  path: "/regions/list",
  operationId: "regionList",
  tags: ["Location / Regions"],
  middleware: [locationMethodsRateLimit, regionRbac.custom("getAll")],
  summary: "List regions",
  request: {
    query: regionListQuerySchema,
  },
  responses: {
    200: createApiSuccessResponse(regionListResponseSchema, "Regions fetched successfully"),
  },
});

export const getRegion = createOpenApiRoute({
  method: "get",
  path: "/regions/{id}",
  operationId: "regionGetById",
  tags: ["Location / Regions"],
  middleware: [locationMethodsRateLimit, regionRbac.get],
  summary: "Get a region by ID",
  request: {
    params: IdStringParamSchema(),
    query: regionGetQuerySchema,
  },
  responses: {
    200: createApiSuccessResponse(regionWithZonesSchema, "Region fetched successfully"),
    404: ApiNotFoundOpenApi,
  },
});

export const createRegion = createOpenApiRoute({
  method: "post",
  path: "/regions",
  operationId: "regionCreate",
  tags: ["Location / Regions"],
  middleware: [locationMethodsRateLimit, regionRbac.custom("create")],
  summary: "Create a region",
  request: {
    body: createApiJsonBody(regionCreateSchema),
  },
  responses: {
    201: createApiSuccessResponse(regionSchema, "Region created successfully"),
  },
});

export const updateRegion = createOpenApiRoute({
  method: "patch",
  path: "/regions/{id}",
  operationId: "regionUpdateById",
  tags: ["Location / Regions"],
  middleware: [locationMethodsRateLimit, regionRbac.custom("update")],
  summary: "Update a region by ID",
  request: {
    params: IdStringParamSchema(),
    body: createApiJsonBody(regionUpdateSchema),
  },
  responses: {
    200: createApiSuccessResponse(regionSchema, "Region updated successfully"),
    404: ApiNotFoundOpenApi,
  },
});

export const removeRegion = createOpenApiRoute({
  method: "delete",
  path: "/regions/{id}",
  operationId: "regionDeleteById",
  tags: ["Location / Regions"],
  middleware: [locationMethodsRateLimit, regionRbac.custom("delete")],
  summary: "Soft delete a region",
  request: {
    params: IdStringParamSchema(),
  },
  responses: {
    200: createApiSuccessResponse(regionSchema, "Region deleted successfully"),
    404: ApiNotFoundOpenApi,
  },
});

export const restoreRegion = createOpenApiRoute({
  method: "patch",
  path: "/regions/{id}/restore",
  operationId: "regionRestoreById",
  tags: ["Location / Regions"],
  middleware: [locationMethodsRateLimit, regionRbac.custom(RBAC_ACTIONS.restore)],
  summary: "Restore a region",
  request: {
    params: IdStringParamSchema(),
  },
  responses: {
    200: createApiSuccessResponse(regionSchema, "Region restored successfully"),
    404: ApiNotFoundOpenApi,
  },
});

export const listZones = createOpenApiRoute({
  method: "get",
  path: "/zones/list",
  operationId: "zoneList",
  tags: ["Location / Zones"],
  middleware: [locationMethodsRateLimit, zoneRbac.custom("getAll")],
  summary: "List zones",
  request: {
    query: zoneListQuerySchema,
  },
  responses: {
    200: createApiSuccessResponse(zoneListResponseSchema, "Zones fetched successfully"),
  },
});

export const getZone = createOpenApiRoute({
  method: "get",
  path: "/zones/{id}",
  operationId: "zoneGetById",
  tags: ["Location / Zones"],
  middleware: [locationMethodsRateLimit, zoneRbac.get],
  summary: "Get a zone by ID",
  request: {
    params: IdStringParamSchema(),
    query: zoneGetQuerySchema,
  },
  responses: {
    200: createApiSuccessResponse(zoneWithRegionSchema, "Zone fetched successfully"),
    404: ApiNotFoundOpenApi,
  },
});

export const createZone = createOpenApiRoute({
  method: "post",
  path: "/zones",
  operationId: "zoneCreate",
  tags: ["Location / Zones"],
  middleware: [locationMethodsRateLimit, zoneRbac.custom("create")],
  summary: "Create a zone",
  request: {
    body: createApiJsonBody(zoneCreateSchema),
  },
  responses: {
    201: createApiSuccessResponse(zoneSchema, "Zone created successfully"),
  },
});

export const updateZone = createOpenApiRoute({
  method: "patch",
  path: "/zones/{id}",
  operationId: "zoneUpdateById",
  tags: ["Location / Zones"],
  middleware: [locationMethodsRateLimit, zoneRbac.custom("update")],
  summary: "Update a zone by ID",
  request: {
    params: IdStringParamSchema(),
    body: createApiJsonBody(zoneUpdateSchema),
  },
  responses: {
    200: createApiSuccessResponse(zoneSchema, "Zone updated successfully"),
    404: ApiNotFoundOpenApi,
  },
});

export const removeZone = createOpenApiRoute({
  method: "delete",
  path: "/zones/{id}",
  operationId: "zoneDeleteById",
  tags: ["Location / Zones"],
  middleware: [locationMethodsRateLimit, zoneRbac.custom("delete")],
  summary: "Soft delete a zone",
  request: {
    params: IdStringParamSchema(),
  },
  responses: {
    200: createApiSuccessResponse(zoneSchema, "Zone deleted successfully"),
    404: ApiNotFoundOpenApi,
  },
});

export const restoreZone = createOpenApiRoute({
  method: "patch",
  path: "/zones/{id}/restore",
  operationId: "zoneRestoreById",
  tags: ["Location / Zones"],
  middleware: [locationMethodsRateLimit, zoneRbac.custom(RBAC_ACTIONS.restore)],
  summary: "Restore a zone",
  request: {
    params: IdStringParamSchema(),
  },
  responses: {
    200: createApiSuccessResponse(zoneSchema, "Zone restored successfully"),
    404: ApiNotFoundOpenApi,
  },
});

export const listLocations = createOpenApiRoute({
  method: "get",
  path: "/locations/list",
  operationId: "zoneLocationList",
  tags: ["Location / Zone Locations"],
  middleware: [locationMethodsRateLimit, locationRbac.custom("getAll")],
  summary: "List zone locations",
  request: {
    query: locationListQuerySchema,
  },
  responses: {
    200: createApiSuccessResponse(locationListResponseSchema, "Locations fetched successfully"),
  },
});

export const getLocation = createOpenApiRoute({
  method: "get",
  path: "/locations/{id}",
  operationId: "zoneLocationGetById",
  tags: ["Location / Zone Locations"],
  middleware: [locationMethodsRateLimit, locationRbac.get],
  summary: "Get a zone location by ID",
  request: {
    params: IdStringParamSchema(),
    query: locationGetQuerySchema,
  },
  responses: {
    200: createApiSuccessResponse(locationWithZoneSchema, "Location fetched successfully"),
    404: ApiNotFoundOpenApi,
  },
});

export const createLocation = createOpenApiRoute({
  method: "post",
  path: "/locations",
  operationId: "zoneLocationCreate",
  tags: ["Location / Zone Locations"],
  middleware: [locationMethodsRateLimit, locationRbac.custom("create")],
  summary: "Create a zone location",
  request: {
    body: createApiJsonBody(locationCreateSchema),
  },
  responses: {
    201: createApiSuccessResponse(locationSchema, "Location created successfully"),
  },
});

export const updateLocation = createOpenApiRoute({
  method: "patch",
  path: "/locations/{id}",
  operationId: "zoneLocationUpdateById",
  tags: ["Location / Zone Locations"],
  middleware: [locationMethodsRateLimit, locationRbac.custom("update")],
  summary: "Update a zone location by ID",
  request: {
    params: IdStringParamSchema(),
    body: createApiJsonBody(locationUpdateSchema),
  },
  responses: {
    200: createApiSuccessResponse(locationSchema, "Location updated successfully"),
    404: ApiNotFoundOpenApi,
  },
});

export const removeLocation = createOpenApiRoute({
  method: "delete",
  path: "/locations/{id}",
  operationId: "zoneLocationDeleteById",
  tags: ["Location / Zone Locations"],
  middleware: [locationMethodsRateLimit, locationRbac.custom("delete")],
  summary: "Soft delete a zone location",
  request: {
    params: IdStringParamSchema(),
  },
  responses: {
    200: createApiSuccessResponse(locationSchema, "Location deleted successfully"),
    404: ApiNotFoundOpenApi,
  },
});

export const restoreLocation = createOpenApiRoute({
  method: "patch",
  path: "/locations/{id}/restore",
  operationId: "zoneLocationRestoreById",
  tags: ["Location / Zone Locations"],
  middleware: [locationMethodsRateLimit, locationRbac.custom(RBAC_ACTIONS.restore)],
  summary: "Restore a zone location",
  request: {
    params: IdStringParamSchema(),
  },
  responses: {
    200: createApiSuccessResponse(locationSchema, "Location restored successfully"),
    404: ApiNotFoundOpenApi,
  },
});
