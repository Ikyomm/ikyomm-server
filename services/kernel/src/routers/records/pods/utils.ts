import { aromaDefusers, db, pods, zoneLocation } from "@ikyomm/database";
import { generateNextOmmpodsId as generateNextPodsId } from "@ikyomm/utils";
import { and, desc, eq } from "drizzle-orm";

type IncludeDeletedOptions = {
  includeDeleted?: boolean;
};

function mapPodLocationHierarchy<TPod extends Record<string, unknown> | undefined>(pod: TPod) {
  if (!pod) {
    return pod;
  }

  const location = pod.location as
    | ({
        zone?:
          | ({
              region?: unknown;
              regionId?: string | null;
            } & Record<string, unknown>)
          | null;
        zoneId?: string | null;
      } & Record<string, unknown>)
    | null
    | undefined;
  const zoneData = location?.zone ?? null;
  const regionData = zoneData?.region ?? null;

  return {
    ...pod,
    regionId: zoneData?.regionId ?? null,
    zoneId: location?.zoneId ?? null,
    region: regionData,
    zone: zoneData,
  };
}

export async function findPodById(id: string, options?: IncludeDeletedOptions) {
  const pod = await db.query.pods.findFirst({
    where: options?.includeDeleted
      ? eq(pods.id, id)
      : and(eq(pods.id, id), eq(pods.isDeleted, false)),
    with: {
      location: {
        with: {
          zone: {
            with: {
              region: true,
            },
          },
        },
      },
      aromaDefuser: true,
    },
  });

  return mapPodLocationHierarchy(pod);
}

export async function findNextPodId() {
  const latestPod = await db
    .select({
      id: pods.id,
    })
    .from(pods)
    .orderBy(desc(pods.id))
    .limit(1)
    .then((rows) => rows[0]);

  return generateNextPodsId(latestPod?.id);
}

export async function validatePodLocationAssignment(input: { locationId?: string | null }) {
  const locationData = input.locationId
    ? await db
        .select({ id: zoneLocation.id })
        .from(zoneLocation)
        .where(and(eq(zoneLocation.id, input.locationId), eq(zoneLocation.isDeleted, false)))
        .limit(1)
        .then((rows) => rows[0])
    : null;

  if (input.locationId && !locationData) {
    return { valid: false as const, message: "Location not found" };
  }

  return { valid: true as const };
}

export async function validatePodAromaDefuserAssignment(input: { aromaDefuserId?: string | null }) {
  const aromaDefuser = input.aromaDefuserId
    ? await db
        .select({ id: aromaDefusers.id })
        .from(aromaDefusers)
        .where(and(eq(aromaDefusers.id, input.aromaDefuserId), eq(aromaDefusers.isDeleted, false)))
        .limit(1)
        .then((rows) => rows[0])
    : null;

  if (input.aromaDefuserId && !aromaDefuser) {
    return { valid: false as const, message: "Aroma Defuser not found" };
  }

  return { valid: true as const };
}
