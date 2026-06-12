import { region, zone, zoneLocation } from "@ikyomm/database";
import {
  createDbInsertSchema,
  createDbSelectSchema,
  createDbUpdateSchema,
  createListQuerySchema,
  createListResponseSchema,
  optionalBooleanQuerySchema,
} from "@ikyomm/utils";
import { z } from "@hono/zod-openapi";

export const regionSchema = createDbSelectSchema(region);
export const zoneSchema = createDbSelectSchema(zone);
export const locationSchema = createDbSelectSchema(zoneLocation);

export const regionWithZonesSchema = regionSchema.extend({
  zones: z.array(zoneSchema).default([]),
});

export const zoneWithRegionSchema = zoneSchema.extend({
  region: regionSchema.nullable().optional(),
  locations: z.array(locationSchema).default([]),
});

export const locationWithZoneSchema = locationSchema.extend({
  zone: zoneSchema.nullable().optional(),
});

const auditColumns = [
  "id",
  "createdAt",
  "updatedAt",
  "deletedAt",
  "isDeleted",
  "createdByUser",
  "updatedByUser",
  "deletedByUser",
] as const;

const optionalLocationTextColumns = {
  locationType: z.string().nullish(),
  description: z.string().nullish(),
  address: z.string().nullish(),
  latitude: z.string().nullish(),
  longitude: z.string().nullish(),
};

export const regionCreateSchema = createDbInsertSchema(region, {
  omit: auditColumns,
});

export const regionUpdateSchema = createDbUpdateSchema(region, {
  omit: auditColumns,
});

export const regionListQuerySchema = createListQuerySchema({
  sortFields: ["id", "name", "createdAt", "updatedAt"],
  extraShape: {
    includeZones: optionalBooleanQuerySchema.default(true),
    isDeleted: optionalBooleanQuerySchema,
  },
});

export const regionGetQuerySchema = z.object({
  includeZones: optionalBooleanQuerySchema.default(true),
});

export type RegionListQuery = z.infer<typeof regionListQuerySchema>;
export const regionListResponseSchema = createListResponseSchema(regionWithZonesSchema);

export const zoneCreateSchema = createDbInsertSchema(zone, {
  omit: auditColumns,
});

export const zoneUpdateSchema = createDbUpdateSchema(zone, {
  omit: auditColumns,
});

export const zoneListQuerySchema = createListQuerySchema({
  sortFields: ["id", "name", "regionId", "createdAt", "updatedAt"],
  extraShape: {
    regionId: z.string().optional(),
    includeRegion: optionalBooleanQuerySchema.default(true),
    includeLocations: optionalBooleanQuerySchema.default(false),
    isDeleted: optionalBooleanQuerySchema,
  },
});

export const zoneGetQuerySchema = z.object({
  includeRegion: optionalBooleanQuerySchema.default(true),
  includeLocations: optionalBooleanQuerySchema.default(true),
});

export type ZoneListQuery = z.infer<typeof zoneListQuerySchema>;
export const zoneListResponseSchema = createListResponseSchema(zoneWithRegionSchema);

export const locationCreateSchema = createDbInsertSchema(zoneLocation, {
  omit: auditColumns,
}).extend(optionalLocationTextColumns);

export const locationUpdateSchema = createDbUpdateSchema(zoneLocation, {
  omit: auditColumns,
}).extend(optionalLocationTextColumns);

export const locationListQuerySchema = createListQuerySchema({
  sortFields: ["id", "name", "locationType", "zoneId", "createdAt", "updatedAt"],
  extraShape: {
    zoneId: z.string().optional(),
    includeZone: optionalBooleanQuerySchema.default(true),
    isDeleted: optionalBooleanQuerySchema,
  },
});

export const locationGetQuerySchema = z.object({
  includeZone: optionalBooleanQuerySchema.default(true),
});

export type LocationListQuery = z.infer<typeof locationListQuerySchema>;
export const locationListResponseSchema = createListResponseSchema(locationWithZoneSchema);
