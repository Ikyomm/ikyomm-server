import type { AppBindings } from "@/types/app";
import { OpenAPIHono } from "@hono/zod-openapi";
import { db, region, zone, zoneLocation } from "@ikyomm/database";
import {
  createErrorResponse,
  createSuccessResponse,
  generateRandomId,
  getBetterAuthContext,
  registerOpenApiRoute,
} from "@ikyomm/utils";
import { eq } from "drizzle-orm";
import { fetchLocationList, fetchRegionList, fetchZoneList } from "./list";
import {
  createLocation,
  createRegion,
  createZone,
  getLocation,
  getRegion,
  getZone,
  listLocations,
  listRegions,
  listZones,
  removeLocation,
  removeRegion,
  removeZone,
  restoreLocation,
  restoreRegion,
  restoreZone,
  updateLocation,
  updateRegion,
  updateZone,
} from "./openapi.route";
import {
  attachLocationsToZones,
  attachRegionToZones,
  attachZonesToRegions,
  attachZoneToLocations,
  findLocationById,
  findLocationByZoneAndName,
  findRegionById,
  findRegionByName,
  findZoneById,
  findZoneByRegionAndName,
  hasActiveLocation,
  hasActiveZone,
} from "./utils";

export const locationCrudGroup = new OpenAPIHono<AppBindings>();

registerOpenApiRoute(locationCrudGroup, listRegions, async (c) => {
  const query = c.req.valid("query");
  const response = await fetchRegionList(query);
  const items = await attachZonesToRegions(response.items, query.includeZones);

  return c.json(createSuccessResponse({ ...response, items }), 200);
});

registerOpenApiRoute(locationCrudGroup, getRegion, async (c) => {
  const { id } = c.req.valid("param");
  const query = c.req.valid("query");
  const regionData = await findRegionById(id);

  if (!regionData) {
    return c.json(createErrorResponse({ error: "Not Found", message: "Region not found" }), 404);
  }

  const [item] = await attachZonesToRegions([regionData], query.includeZones);
  return c.json(createSuccessResponse(item), 200);
});

registerOpenApiRoute(locationCrudGroup, createRegion, async (c) => {
  const body = c.req.valid("json");
  const { user } = getBetterAuthContext(c);

  if (await findRegionByName(body.name)) {
    return c.json(
      createErrorResponse({ error: "Conflict", message: "Region with this name already exists" }),
      409
    );
  }

  const [createdRegion] = await db
    .insert(region)
    .values({ id: generateRandomId(), ...body, createdByUser: user?.id ?? null })
    .returning();

  return c.json(createSuccessResponse(createdRegion), 201);
});

registerOpenApiRoute(locationCrudGroup, updateRegion, async (c) => {
  const { id } = c.req.valid("param");
  const body = c.req.valid("json");
  const { user } = getBetterAuthContext(c);

  if (!(await findRegionById(id))) {
    return c.json(createErrorResponse({ error: "Not Found", message: "Region not found" }), 404);
  }

  if (body.name && (await findRegionByName(body.name, { excludeId: id }))) {
    return c.json(
      createErrorResponse({ error: "Conflict", message: "Region with this name already exists" }),
      409
    );
  }

  const [updatedRegion] = await db
    .update(region)
    .set({ ...body, updatedByUser: user?.id ?? null })
    .where(eq(region.id, id))
    .returning();

  return c.json(createSuccessResponse(updatedRegion), 200);
});

registerOpenApiRoute(locationCrudGroup, removeRegion, async (c) => {
  const { id } = c.req.valid("param");
  const { user } = getBetterAuthContext(c);

  const regionData = await findRegionById(id);
  if (!regionData) {
    return c.json(createErrorResponse({ error: "Not Found", message: "Region not found" }), 404);
  }

  if (await hasActiveZone(id)) {
    return c.json(
      createErrorResponse({ error: "Conflict", message: "Cannot delete region with active zones" }),
      409
    );
  }

  const [deletedRegion] = await db
    .update(region)
    .set({
      isDeleted: true,
      deletedAt: new Date(),
      deletedByUser: user?.id ?? null,
      updatedByUser: user?.id ?? null,
    })
    .where(eq(region.id, id))
    .returning();

  return c.json(createSuccessResponse(deletedRegion), 200);
});

registerOpenApiRoute(locationCrudGroup, restoreRegion, async (c) => {
  const { id } = c.req.valid("param");
  const { user } = getBetterAuthContext(c);

  if (!(await findRegionById(id, { includeDeleted: true }))) {
    return c.json(createErrorResponse({ error: "Not Found", message: "Region not found" }), 404);
  }

  const [restoredRegion] = await db
    .update(region)
    .set({
      isDeleted: false,
      deletedAt: null,
      deletedByUser: null,
      updatedByUser: user?.id ?? null,
    })
    .where(eq(region.id, id))
    .returning();

  return c.json(createSuccessResponse(restoredRegion), 200);
});

registerOpenApiRoute(locationCrudGroup, listZones, async (c) => {
  const query = c.req.valid("query");
  const response = await fetchZoneList(query);
  const withRegion = await attachRegionToZones(response.items, query.includeRegion);
  const items = await attachLocationsToZones(withRegion, query.includeLocations);

  return c.json(createSuccessResponse({ ...response, items }), 200);
});

registerOpenApiRoute(locationCrudGroup, getZone, async (c) => {
  const { id } = c.req.valid("param");
  const query = c.req.valid("query");
  const zoneData = await findZoneById(id);

  if (!zoneData) {
    return c.json(createErrorResponse({ error: "Not Found", message: "Zone not found" }), 404);
  }

  const [withRegion] = await attachRegionToZones([zoneData], query.includeRegion);
  const [item] = await attachLocationsToZones([withRegion], query.includeLocations);
  return c.json(createSuccessResponse(item), 200);
});

registerOpenApiRoute(locationCrudGroup, createZone, async (c) => {
  const body = c.req.valid("json");
  const { user } = getBetterAuthContext(c);

  if (!(await findRegionById(body.regionId))) {
    return c.json(createErrorResponse({ error: "Not Found", message: "Region not found" }), 404);
  }

  if (await findZoneByRegionAndName(body.regionId, body.name)) {
    return c.json(
      createErrorResponse({ error: "Conflict", message: "Zone with this name already exists" }),
      409
    );
  }

  const [createdZone] = await db
    .insert(zone)
    .values({ id: generateRandomId(), ...body, createdByUser: user?.id ?? null })
    .returning();

  return c.json(createSuccessResponse(createdZone), 201);
});

registerOpenApiRoute(locationCrudGroup, updateZone, async (c) => {
  const { id } = c.req.valid("param");
  const body = c.req.valid("json");
  const { user } = getBetterAuthContext(c);
  const existingZone = await findZoneById(id);

  if (!existingZone) {
    return c.json(createErrorResponse({ error: "Not Found", message: "Zone not found" }), 404);
  }

  const nextRegionId = body.regionId ?? existingZone.regionId;
  const nextName = body.name ?? existingZone.name;

  if (!(await findRegionById(nextRegionId))) {
    return c.json(createErrorResponse({ error: "Not Found", message: "Region not found" }), 404);
  }

  if (await findZoneByRegionAndName(nextRegionId, nextName, { excludeId: id })) {
    return c.json(
      createErrorResponse({ error: "Conflict", message: "Zone with this name already exists" }),
      409
    );
  }

  const [updatedZone] = await db
    .update(zone)
    .set({ ...body, updatedByUser: user?.id ?? null })
    .where(eq(zone.id, id))
    .returning();

  return c.json(createSuccessResponse(updatedZone), 200);
});

registerOpenApiRoute(locationCrudGroup, removeZone, async (c) => {
  const { id } = c.req.valid("param");
  const { user } = getBetterAuthContext(c);

  if (!(await findZoneById(id))) {
    return c.json(createErrorResponse({ error: "Not Found", message: "Zone not found" }), 404);
  }

  if (await hasActiveLocation(id)) {
    return c.json(
      createErrorResponse({
        error: "Conflict",
        message: "Cannot delete zone with active locations",
      }),
      409
    );
  }

  const [deletedZone] = await db
    .update(zone)
    .set({
      isDeleted: true,
      deletedAt: new Date(),
      deletedByUser: user?.id ?? null,
      updatedByUser: user?.id ?? null,
    })
    .where(eq(zone.id, id))
    .returning();

  return c.json(createSuccessResponse(deletedZone), 200);
});

registerOpenApiRoute(locationCrudGroup, restoreZone, async (c) => {
  const { id } = c.req.valid("param");
  const { user } = getBetterAuthContext(c);

  if (!(await findZoneById(id, { includeDeleted: true }))) {
    return c.json(createErrorResponse({ error: "Not Found", message: "Zone not found" }), 404);
  }

  const [restoredZone] = await db
    .update(zone)
    .set({
      isDeleted: false,
      deletedAt: null,
      deletedByUser: null,
      updatedByUser: user?.id ?? null,
    })
    .where(eq(zone.id, id))
    .returning();

  return c.json(createSuccessResponse(restoredZone), 200);
});

registerOpenApiRoute(locationCrudGroup, listLocations, async (c) => {
  const query = c.req.valid("query");
  const response = await fetchLocationList(query);
  const items = await attachZoneToLocations(response.items, query.includeZone);

  return c.json(createSuccessResponse({ ...response, items }), 200);
});

registerOpenApiRoute(locationCrudGroup, getLocation, async (c) => {
  const { id } = c.req.valid("param");
  const query = c.req.valid("query");
  const locationData = await findLocationById(id);

  if (!locationData) {
    return c.json(createErrorResponse({ error: "Not Found", message: "Location not found" }), 404);
  }

  const [item] = await attachZoneToLocations([locationData], query.includeZone);
  return c.json(createSuccessResponse(item), 200);
});

registerOpenApiRoute(locationCrudGroup, createLocation, async (c) => {
  const body = c.req.valid("json");
  const { user } = getBetterAuthContext(c);
  const locationData = {
    ...body,
    locationType: body.locationType ?? null,
    description: body.description ?? null,
    address: body.address ?? null,
    latitude: body.latitude ?? null,
    longitude: body.longitude ?? null,
  };

  if (!(await findZoneById(locationData.zoneId))) {
    return c.json(createErrorResponse({ error: "Not Found", message: "Zone not found" }), 404);
  }

  if (await findLocationByZoneAndName(locationData.zoneId, locationData.name)) {
    return c.json(
      createErrorResponse({ error: "Conflict", message: "Location with this name already exists" }),
      409
    );
  }

  const [createdLocation] = await db
    .insert(zoneLocation)
    .values({ id: generateRandomId(), ...locationData, createdByUser: user?.id ?? null })
    .returning();

  return c.json(createSuccessResponse(createdLocation), 201);
});

registerOpenApiRoute(locationCrudGroup, updateLocation, async (c) => {
  const { id } = c.req.valid("param");
  const body = c.req.valid("json");
  const { user } = getBetterAuthContext(c);
  const existingLocation = await findLocationById(id);

  if (!existingLocation) {
    return c.json(createErrorResponse({ error: "Not Found", message: "Location not found" }), 404);
  }

  const nextZoneId = body.zoneId ?? existingLocation.zoneId;
  const nextName = body.name ?? existingLocation.name;

  if (!(await findZoneById(nextZoneId))) {
    return c.json(createErrorResponse({ error: "Not Found", message: "Zone not found" }), 404);
  }

  if (await findLocationByZoneAndName(nextZoneId, nextName, { excludeId: id })) {
    return c.json(
      createErrorResponse({ error: "Conflict", message: "Location with this name already exists" }),
      409
    );
  }

  const [updatedLocation] = await db
    .update(zoneLocation)
    .set({ ...body, updatedByUser: user?.id ?? null })
    .where(eq(zoneLocation.id, id))
    .returning();

  return c.json(createSuccessResponse(updatedLocation), 200);
});

registerOpenApiRoute(locationCrudGroup, removeLocation, async (c) => {
  const { id } = c.req.valid("param");
  const { user } = getBetterAuthContext(c);

  if (!(await findLocationById(id))) {
    return c.json(createErrorResponse({ error: "Not Found", message: "Location not found" }), 404);
  }

  const [deletedLocation] = await db
    .update(zoneLocation)
    .set({
      isDeleted: true,
      deletedAt: new Date(),
      deletedByUser: user?.id ?? null,
      updatedByUser: user?.id ?? null,
    })
    .where(eq(zoneLocation.id, id))
    .returning();

  return c.json(createSuccessResponse(deletedLocation), 200);
});

registerOpenApiRoute(locationCrudGroup, restoreLocation, async (c) => {
  const { id } = c.req.valid("param");
  const { user } = getBetterAuthContext(c);

  if (!(await findLocationById(id, { includeDeleted: true }))) {
    return c.json(createErrorResponse({ error: "Not Found", message: "Location not found" }), 404);
  }

  const [restoredLocation] = await db
    .update(zoneLocation)
    .set({
      isDeleted: false,
      deletedAt: null,
      deletedByUser: null,
      updatedByUser: user?.id ?? null,
    })
    .where(eq(zoneLocation.id, id))
    .returning();

  return c.json(createSuccessResponse(restoredLocation), 200);
});
