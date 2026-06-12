import { OmmPodStatus, OmmPodType, pods, region, zone, zoneLocation } from "@ikyomm/database";
import {
  createDbInsertSchema,
  createDbSelectSchema,
  createDbUpdateSchema,
  createListQuerySchema,
  createListResponseSchema,
  optionalBooleanQuerySchema,
} from "@ikyomm/utils";
import { z } from "@hono/zod-openapi";

const connectedDeviceConfigItemSchema = z.object({
  key: z.string().trim().min(1),
  value: z.string().trim().min(1),
});

export const connectedDeviceConfigSchema = z.array(connectedDeviceConfigItemSchema);

const rateSlabSchema = z.object({
  minute: z.number().min(1),
  credit: z.number().min(1),
});

export const rateConfigSchema = z.array(rateSlabSchema);

const assignmentSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
});

export const podSchema = createDbSelectSchema(pods).extend({
  connectedDeviceConfig: connectedDeviceConfigSchema,
  rateConfig: z.preprocess((value) => value ?? [], rateConfigSchema),
  regionId: z.string().nullable().optional(),
  zoneId: z.string().nullable().optional(),
  region: assignmentSummarySchema.nullable(),
  zone: assignmentSummarySchema.nullable(),
  location: assignmentSummarySchema.nullable(),
});

export const podCreateSchema = createDbInsertSchema(pods, {
  omit: [
    "id",
    "createdAt",
    "updatedAt",
    "deletedAt",
    "isDeleted",
    "createdByUser",
    "updatedByUser",
    "deletedByUser",
  ],
}).extend({
  connectedDeviceConfig: connectedDeviceConfigSchema.optional(),
  rateConfig: rateConfigSchema.optional(),
});

export const podUpdateSchema = createDbUpdateSchema(pods, {
  omit: [
    "id",
    "createdAt",
    "updatedAt",
    "deletedAt",
    "isDeleted",
    "createdByUser",
    "updatedByUser",
    "deletedByUser",
  ],
}).extend({
  connectedDeviceConfig: connectedDeviceConfigSchema.optional(),
  rateConfig: rateConfigSchema.optional(),
});

export const podListSortFields = [
  "id",
  "name",
  "type",
  "status",
  "regionId",
  "zoneId",
  "locationId",
  "createdAt",
  "updatedAt",
] as const;

export const podListQuerySchema = createListQuerySchema({
  sortFields: podListSortFields,
  extraShape: {
    type: z.enum(OmmPodType.enumValues).optional(),
    status: z.enum(OmmPodStatus.enumValues).optional(),
    regionId: z.string().optional(),
    zoneId: z.string().optional(),
    locationId: z.string().optional(),
    isDeleted: optionalBooleanQuerySchema,
  },
});

export type PodListQuery = z.infer<typeof podListQuerySchema>;

export const podListResponseSchema = createListResponseSchema(podSchema);

export const podDeleteResponseSchema = z.object({
  message: z.string(),
});

export const podDeviceRefsSchema = z.object({
  region: createDbSelectSchema(region),
  zone: createDbSelectSchema(zone),
  location: createDbSelectSchema(zoneLocation),
});
