import { aromaDefusers, db, pods, zoneLocation } from "@ikyomm/database";
import { generateNextOmmpodsId as generateNextPodsId } from "@ikyomm/utils";
import { and, desc, eq, inArray } from "drizzle-orm";

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

export async function findAromaDefusersByIds(aromaDefuserIds: string[] = []) {
  const uniqueIds = [...new Set(aromaDefuserIds.filter(Boolean))];

  if (uniqueIds.length === 0) {
    return [];
  }

  const rows = await db
    .select({
      id: aromaDefusers.id,
      name: aromaDefusers.name,
      macId: aromaDefusers.macId,
      containers: aromaDefusers.containers,
    })
    .from(aromaDefusers)
    .where(and(inArray(aromaDefusers.id, uniqueIds), eq(aromaDefusers.isDeleted, false)));
  const rowById = new Map(rows.map((row) => [row.id, row]));

  return uniqueIds
    .map((id) => rowById.get(id))
    .filter((row): row is (typeof rows)[number] => Boolean(row));
}

async function hydratePodAromaDefusers<TPod extends Record<string, unknown> | undefined>(
  pod: TPod
) {
  if (!pod) {
    return pod;
  }

  const aromaDefusersList = await findAromaDefusersByIds(
    Array.isArray(pod.aromaDefuserIds) ? (pod.aromaDefuserIds as string[]) : []
  );

  return {
    ...pod,
    aromaDefusers: aromaDefusersList,
    aromaDefuser: aromaDefusersList[0] ?? null,
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
    },
  });

  return hydratePodAromaDefusers(mapPodLocationHierarchy(pod));
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

export async function validatePodAromaDefuserAssignment(input: {
  aromaDefuserIds?: string[] | null;
}) {
  const aromaDefuserIds = input.aromaDefuserIds ?? [];
  const uniqueIds = [...new Set(aromaDefuserIds.filter(Boolean))];

  if (uniqueIds.length !== aromaDefuserIds.length) {
    return { valid: false as const, message: "Aroma Defuser IDs must be unique" };
  }

  if (uniqueIds.length === 0) {
    return { valid: true as const };
  }

  const existingAromaDefusers = await db
    .select({ id: aromaDefusers.id })
    .from(aromaDefusers)
    .where(and(inArray(aromaDefusers.id, uniqueIds), eq(aromaDefusers.isDeleted, false)));
  const existingIds = new Set(existingAromaDefusers.map((aromaDefuser) => aromaDefuser.id));
  const missingIds = uniqueIds.filter((id) => !existingIds.has(id));

  if (missingIds.length > 0) {
    return { valid: false as const, message: `Aroma Defuser not found: ${missingIds.join(", ")}` };
  }

  return { valid: true as const };
}
