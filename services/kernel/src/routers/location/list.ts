import { getDB, region, zone, zoneLocation } from "@ikyomm/database";
import { createTableListFetcher } from "@ikyomm/utils";
import { eq } from "drizzle-orm";
import type { LocationListQuery, RegionListQuery, ZoneListQuery } from "./schema";

export const fetchRegionList = createTableListFetcher<
  typeof region,
  typeof region.$inferSelect,
  RegionListQuery
>({
  db: getDB,
  table: region,
  where: ({ params }) => eq(region.isDeleted, params.isDeleted ?? false),
  search: {
    exact: [region.id],
    prefix: [region.name],
    contains: [region.description],
  },
  sorting: {
    defaultBy: "createdAt",
    defaultOrder: "desc",
  },
  sortColumns: {
    id: region.id,
    name: region.name,
    createdAt: region.createdAt,
    updatedAt: region.updatedAt,
  },
});

export const fetchZoneList = createTableListFetcher<
  typeof zone,
  typeof zone.$inferSelect,
  ZoneListQuery
>({
  db: getDB,
  table: zone,
  where: ({ params }) => eq(zone.isDeleted, params.isDeleted ?? false),
  search: {
    exact: [zone.id, zone.regionId],
    prefix: [zone.name],
    contains: [zone.description],
  },
  filterColumns: {
    regionId: zone.regionId,
  },
  sorting: {
    defaultBy: "createdAt",
    defaultOrder: "desc",
  },
  sortColumns: {
    id: zone.id,
    name: zone.name,
    regionId: zone.regionId,
    createdAt: zone.createdAt,
    updatedAt: zone.updatedAt,
  },
});

export const fetchLocationList = createTableListFetcher<
  typeof zoneLocation,
  typeof zoneLocation.$inferSelect,
  LocationListQuery
>({
  db: getDB,
  table: zoneLocation,
  where: ({ params }) => eq(zoneLocation.isDeleted, params.isDeleted ?? false),
  search: {
    exact: [zoneLocation.id, zoneLocation.zoneId],
    prefix: [zoneLocation.name, zoneLocation.locationType],
    contains: [zoneLocation.description, zoneLocation.address],
  },
  filterColumns: {
    zoneId: zoneLocation.zoneId,
  },
  sorting: {
    defaultBy: "createdAt",
    defaultOrder: "desc",
  },
  sortColumns: {
    id: zoneLocation.id,
    name: zoneLocation.name,
    locationType: zoneLocation.locationType,
    zoneId: zoneLocation.zoneId,
    createdAt: zoneLocation.createdAt,
    updatedAt: zoneLocation.updatedAt,
  },
});
