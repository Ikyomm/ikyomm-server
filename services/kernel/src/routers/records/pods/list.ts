/** biome-ignore-all lint/suspicious/noExplicitAny: Drizzle query builders are intentionally passed through reusable helpers. */
import {
  getDB,
  pods,
  region,
  zone,
  zoneLocation,
} from "@ikyomm/database";
import { createTableListFetcher } from "@ikyomm/utils";
import { eq } from "drizzle-orm";
import type { PodListQuery } from "./schema";

function podListJoins(queryBuilder: any) {
  return queryBuilder
    .leftJoin(zoneLocation, eq(zoneLocation.id, pods.locationId))
    .leftJoin(zone, eq(zone.id, zoneLocation.zoneId))
    .leftJoin(region, eq(region.id, zone.regionId));
}

function mapPodListItem(row: Record<string, unknown>) {
  const {
    regionIdValue,
    regionName,
    regionDescription,
    zoneIdValue,
    zoneName,
    zoneDescription,
    locationIdValue,
    locationName,
    locationDescription,
    ...pod
  } = row;

  return {
    ...(pod as Record<string, unknown>),
    region: regionIdValue
      ? {
          id: String(regionIdValue),
          name: String(regionName),
          description: (regionDescription as string | null | undefined) ?? null,
        }
      : null,
    regionId: (regionIdValue as string | null | undefined) ?? null,
    zone: zoneIdValue
      ? {
          id: String(zoneIdValue),
          name: String(zoneName),
          description: (zoneDescription as string | null | undefined) ?? null,
        }
      : null,
    zoneId: (zoneIdValue as string | null | undefined) ?? null,
    location: locationIdValue
      ? {
          id: String(locationIdValue),
          name: String(locationName),
          description: (locationDescription as string | null | undefined) ?? null,
        }
      : null,
  };
}

export const fetchPodsList = createTableListFetcher<
  typeof pods,
  ReturnType<typeof mapPodListItem>,
  PodListQuery
>({
  db: getDB,
  table: pods,
  select: (columns) => ({
    ...columns,
    regionIdValue: region.id,
    regionName: region.name,
    regionDescription: region.description,
    zoneIdValue: zone.id,
    zoneName: zone.name,
    zoneDescription: zone.description,
    locationIdValue: zoneLocation.id,
    locationName: zoneLocation.name,
    locationDescription: zoneLocation.description,
  }),
  joins: podListJoins,
  where: ({ params }) => eq(pods.isDeleted, params.isDeleted ?? false),
  search: {
    exact: [pods.id],
    prefix: [
      region.id,
      region.name,
      zone.id,
      zone.name,
      pods.locationId,
      zoneLocation.name,
    ],
    contains: [pods.name],
  },
  filterColumns: {
    type: pods.type,
    status: pods.status,
    regionId: region.id,
    zoneId: zone.id,
    locationId: pods.locationId,
  },
  sorting: {
    defaultBy: "createdAt",
    defaultOrder: "desc",
  },
  sortColumns: {
    id: pods.id,
    name: pods.name,
    type: pods.type,
    status: pods.status,
    regionId: region.id,
    zoneId: zone.id,
    locationId: pods.locationId,
    createdAt: pods.createdAt,
    updatedAt: pods.updatedAt,
  },
  counts: {
    totalJoins: "data",
  },
  mapItem: mapPodListItem,
});
