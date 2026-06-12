import { db, region, zone, zoneLocation } from "@ikyomm/database";
import { and, eq, inArray, ne } from "drizzle-orm";

type IncludeDeletedOptions = {
  includeDeleted?: boolean;
};

type UniqueLookupOptions = {
  excludeId?: string;
};

export async function findRegionById(id: string, options?: IncludeDeletedOptions) {
  return db
    .select()
    .from(region)
    .where(
      options?.includeDeleted
        ? eq(region.id, id)
        : and(eq(region.id, id), eq(region.isDeleted, false))
    )
    .limit(1)
    .then((rows) => rows[0]);
}

export async function findZoneById(id: string, options?: IncludeDeletedOptions) {
  return db
    .select()
    .from(zone)
    .where(
      options?.includeDeleted ? eq(zone.id, id) : and(eq(zone.id, id), eq(zone.isDeleted, false))
    )
    .limit(1)
    .then((rows) => rows[0]);
}

export async function findLocationById(id: string, options?: IncludeDeletedOptions) {
  return db
    .select()
    .from(zoneLocation)
    .where(
      options?.includeDeleted
        ? eq(zoneLocation.id, id)
        : and(eq(zoneLocation.id, id), eq(zoneLocation.isDeleted, false))
    )
    .limit(1)
    .then((rows) => rows[0]);
}

export async function findRegionByName(name: string, options?: UniqueLookupOptions) {
  const clauses = [eq(region.name, name), eq(region.isDeleted, false)];
  if (options?.excludeId) {
    clauses.push(ne(region.id, options.excludeId));
  }

  return db
    .select({ id: region.id })
    .from(region)
    .where(and(...clauses))
    .limit(1)
    .then((rows) => rows[0]);
}

export async function findZoneByRegionAndName(
  regionId: string,
  name: string,
  options?: UniqueLookupOptions
) {
  const clauses = [eq(zone.regionId, regionId), eq(zone.name, name), eq(zone.isDeleted, false)];
  if (options?.excludeId) {
    clauses.push(ne(zone.id, options.excludeId));
  }

  return db
    .select({ id: zone.id })
    .from(zone)
    .where(and(...clauses))
    .limit(1)
    .then((rows) => rows[0]);
}

export async function findLocationByZoneAndName(
  zoneId: string,
  name: string,
  options?: UniqueLookupOptions
) {
  const clauses = [
    eq(zoneLocation.zoneId, zoneId),
    eq(zoneLocation.name, name),
    eq(zoneLocation.isDeleted, false),
  ];
  if (options?.excludeId) {
    clauses.push(ne(zoneLocation.id, options.excludeId));
  }

  return db
    .select({ id: zoneLocation.id })
    .from(zoneLocation)
    .where(and(...clauses))
    .limit(1)
    .then((rows) => rows[0]);
}

export async function hasActiveZone(regionId: string) {
  return db
    .select({ id: zone.id })
    .from(zone)
    .where(and(eq(zone.regionId, regionId), eq(zone.isDeleted, false)))
    .limit(1)
    .then((rows) => rows[0]);
}

export async function hasActiveLocation(zoneId: string) {
  return db
    .select({ id: zoneLocation.id })
    .from(zoneLocation)
    .where(and(eq(zoneLocation.zoneId, zoneId), eq(zoneLocation.isDeleted, false)))
    .limit(1)
    .then((rows) => rows[0]);
}

export async function attachZonesToRegions<TRegion extends { id: string }>(
  regionsData: TRegion[],
  includeZones?: boolean
) {
  if (!(includeZones && regionsData.length)) {
    return regionsData;
  }

  const regionIds = regionsData.map((item) => item.id);
  const zonesData = await db
    .select()
    .from(zone)
    .where(and(inArray(zone.regionId, regionIds), eq(zone.isDeleted, false)));

  const zonesByRegionId = new Map<string, typeof zonesData>();
  for (const zoneData of zonesData) {
    const items = zonesByRegionId.get(zoneData.regionId) ?? [];
    items.push(zoneData);
    zonesByRegionId.set(zoneData.regionId, items);
  }

  return regionsData.map((regionData) => ({
    ...regionData,
    zones: zonesByRegionId.get(regionData.id) ?? [],
  }));
}

export async function attachRegionToZones<TZone extends { regionId: string }>(
  zonesData: TZone[],
  includeRegion?: boolean
) {
  if (!(includeRegion && zonesData.length)) {
    return zonesData;
  }

  const regionIds = [...new Set(zonesData.map((item) => item.regionId))];
  const regionsData = await db
    .select()
    .from(region)
    .where(and(inArray(region.id, regionIds), eq(region.isDeleted, false)));
  const regionById = new Map(regionsData.map((item) => [item.id, item]));

  return zonesData.map((zoneData) => ({
    ...zoneData,
    region: regionById.get(zoneData.regionId) ?? null,
  }));
}

export async function attachLocationsToZones<TZone extends { id: string }>(
  zonesData: TZone[],
  includeLocations?: boolean
) {
  if (!(includeLocations && zonesData.length)) {
    return zonesData;
  }

  const zoneIds = zonesData.map((item) => item.id);
  const locationsData = await db
    .select()
    .from(zoneLocation)
    .where(and(inArray(zoneLocation.zoneId, zoneIds), eq(zoneLocation.isDeleted, false)));

  const locationsByZoneId = new Map<string, typeof locationsData>();
  for (const locationData of locationsData) {
    const items = locationsByZoneId.get(locationData.zoneId) ?? [];
    items.push(locationData);
    locationsByZoneId.set(locationData.zoneId, items);
  }

  return zonesData.map((zoneData) => ({
    ...zoneData,
    locations: locationsByZoneId.get(zoneData.id) ?? [],
  }));
}

export async function attachZoneToLocations<TLocation extends { zoneId: string }>(
  locationsData: TLocation[],
  includeZone?: boolean
) {
  if (!(includeZone && locationsData.length)) {
    return locationsData;
  }

  const zoneIds = [...new Set(locationsData.map((item) => item.zoneId))];
  const zonesData = await db
    .select()
    .from(zone)
    .where(and(inArray(zone.id, zoneIds), eq(zone.isDeleted, false)));
  const zoneById = new Map(zonesData.map((item) => [item.id, item]));

  return locationsData.map((locationData) => ({
    ...locationData,
    zone: zoneById.get(locationData.zoneId) ?? null,
  }));
}
