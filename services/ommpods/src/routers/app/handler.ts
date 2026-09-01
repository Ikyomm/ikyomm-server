import type { AppBindings } from "@/types/app";
import { OpenAPIHono, z } from "@hono/zod-openapi";
import type { Context } from "hono";
import {
  type OmmPodStatus,
  OmmPodType,
  db,
  musicPlaylists,
  musics,
  organization,
  podMoodPresets,
  podSessions,
  pods,
  userWallet,
  walletTransactions,
} from "@ikyomm/database";
import {
  createApiSuccessResponse,
  createBetterAuthSessionMiddleware,
  createErrorResponse,
  createOpenApiRoute,
  createRequiredAuthSessionMiddleware,
  createSuccessResponse,
  getBetterAuthContext,
  registerOpenApiRoute,
} from "@ikyomm/utils";
import { and, desc, eq, gt, inArray, lte, or, sql } from "drizzle-orm";
import { buildSessionResponse, hydratePodAromaDefusers } from "../shared";

export const appGroup = new OpenAPIHono<AppBindings>();

const appAuthMiddleware = createBetterAuthSessionMiddleware({
  entities: {
    user: true,
    session: true,
    data: false,
    organization: false,
    hasOrganization: false,
  },
  enableRedisCache: true,
  required: false,
});

appGroup.use("*", appAuthMiddleware);

type AppAromaDefuser = {
  id: string;
  name: string | null;
  macId: string;
  containers?: unknown[] | null;
};

type AppPod = typeof pods.$inferSelect & {
  location?: unknown;
  aromaDefuser: AppAromaDefuser | null;
  aromaDefusers: AppAromaDefuser[];
};

function serializeAppPod(pod: AppPod) {
  return {
    ...pod,
    rateConfig: pod.rateConfig ?? [],
    connectedDeviceConfig: pod.connectedDeviceConfig ?? [],
    aromaDefuser: pod.aromaDefuser
      ? {
          id: pod.aromaDefuser.id,
          name: pod.aromaDefuser.name,
          macId: pod.aromaDefuser.macId,
          containers: pod.aromaDefuser.containers ?? [],
        }
      : null,
    aromaDefusers: (pod.aromaDefusers ?? []).map((aromaDefuser) => ({
      id: aromaDefuser.id,
      name: aromaDefuser.name,
      macId: aromaDefuser.macId,
      containers: aromaDefuser.containers ?? [],
    })),
  };
}

appGroup.get("/me", async (c) => {
  const { user: currentUser } = getBetterAuthContext(c);

  if (!currentUser) {
    return c.json(
      createErrorResponse({ error: "Unauthorized", message: "Active session not found" }),
      401
    );
  }

  const wallet = await db.query.userWallet.findFirst({
    where: and(eq(userWallet.userId, currentUser.id), eq(userWallet.isDeleted, false)),
  });
  const company =
    currentUser.company && typeof currentUser.company === "string"
      ? await db.query.organization.findFirst({
          where: and(eq(organization.id, currentUser.company), eq(organization.isDeleted, false)),
        })
      : null;

  const transactions = wallet
    ? await db
        .select()
        .from(walletTransactions)
        .where(
          and(
            eq(walletTransactions.isDeleted, false),
            or(
              eq(walletTransactions.fromUserWalletId, wallet.id),
              eq(walletTransactions.toUserWalletId, wallet.id)
            )
          )
        )
        .orderBy(desc(walletTransactions.transactedAt))
        .limit(20)
    : [];

  return c.json(
    createSuccessResponse({
      user: {
        id: currentUser.id,
        name: currentUser.name ?? null,
        email: currentUser.email ?? null,
        emailVerified: currentUser.emailVerified ?? false,
        role: currentUser.role ?? null,
        panel: currentUser.panel ?? null,
        companyId: currentUser.company ?? null,
        metadata: currentUser.metadata ?? null,
      },
      company: company
        ? {
            id: company.id,
            name: company.name,
            email: company.email,
            type: company.type,
            isActive: company.isActive,
          }
        : null,
      wallet: wallet
        ? {
            id: wallet.id,
            creditMinute: wallet.creditMinute,
          }
        : null,
      transactions: transactions.map((transaction) => ({
        ...transaction,
        direction:
          transaction.fromUserWalletId === wallet?.id && transaction.toUserWalletId === wallet?.id
            ? transaction.type === "DEBIT"
              ? ("debit" as const)
              : transaction.type === "CREDIT"
                ? ("credit" as const)
                : ("internal" as const)
            : transaction.toUserWalletId === wallet?.id
              ? ("credit" as const)
              : ("debit" as const),
      })),
    }),
    200
  );
});

appGroup.get("/sessions/active", async (c) => {
  const { user: currentUser } = getBetterAuthContext(c);

  if (!currentUser) {
    return c.json(
      createErrorResponse({ error: "Unauthorized", message: "Active session not found" }),
      401
    );
  }

  const now = new Date();
  const session = await db.query.podSessions.findFirst({
    where: and(
      eq(podSessions.userId, currentUser.id),
      eq(podSessions.status, "CONFIRMED"),
      eq(podSessions.isDeleted, false),
      gt(podSessions.endAt, now)
    ),
    orderBy: (table, { asc }) => [asc(table.endAt)],
    with: {
      pod: {
        with: {
          location: true,
        },
      },
    },
  });

  const pod = await hydratePodAromaDefusers(session?.pod);

  if (!(session && pod)) {
    return c.json(createSuccessResponse(null), 200);
  }

  return c.json(
    createSuccessResponse({
      session: buildSessionResponse(session, now, pod.location),
      pod: serializeAppPod(pod),
    }),
    200
  );
});

const nearbyPodsQuerySchema = z.object({
  latitude: z.coerce
    .number()
    .min(-90)
    .max(90)
    .optional()
    .openapi({
      param: {
        name: "latitude",
        in: "query",
        description: "User's current GPS latitude (-90 to 90)",
        example: 22.653564,
      },
    }),
  longitude: z.coerce
    .number()
    .min(-180)
    .max(180)
    .optional()
    .openapi({
      param: {
        name: "longitude",
        in: "query",
        description: "User's current GPS longitude (-180 to 180)",
        example: 88.4450847,
      },
    }),
  radiusKm: z.coerce
    .number()
    .positive()
    .default(50)
    .openapi({
      param: {
        name: "radiusKm",
        in: "query",
        description: "Proximity radius in kilometers (defaults to 50km)",
        example: 50,
      },
    }),
  search: z
    .string()
    .trim()
    .optional()
    .openapi({
      param: {
        name: "search",
        in: "query",
        description:
          "Multi-field search across city, airport, station, state, address, or pod name",
        example: "Airport",
      },
    }),
  city: z
    .string()
    .trim()
    .optional()
    .openapi({
      param: {
        name: "city",
        in: "query",
        description: "Filter pods by city name",
        example: "Kolkata",
      },
    }),
  region: z
    .string()
    .trim()
    .optional()
    .openapi({
      param: {
        name: "region",
        in: "query",
        description: "Filter pods by region or state",
        example: "West Bengal",
      },
    }),
  locationType: z
    .string()
    .trim()
    .optional()
    .openapi({
      param: {
        name: "locationType",
        in: "query",
        description: "Filter pods by location type (e.g. AIRPORT, STATION, MALL, HOTEL)",
        example: "AIRPORT",
      },
    }),
  podType: z
    .string()
    .trim()
    .optional()
    .openapi({
      param: {
        name: "podType",
        in: "query",
        description: "Filter by pod model type (NEO, ORIGINAL, MINI)",
        example: "NEO",
      },
    }),
  status: z
    .string()
    .trim()
    .optional()
    .openapi({
      param: {
        name: "status",
        in: "query",
        description: "Filter by pod status (ACTIVE, MAINTENANCE, OFFLINE)",
        example: "ACTIVE",
      },
    }),
  onlyAvailable: z
    .enum(["true", "false"])
    .optional()
    .openapi({
      param: {
        name: "onlyAvailable",
        in: "query",
        description: "If true, returns only currently available and unoccupied pods",
        example: "true",
      },
    }),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .openapi({
      param: {
        name: "limit",
        in: "query",
        description: "Pagination page size (max 100, default 20)",
        example: 20,
      },
    }),
  offset: z.coerce
    .number()
    .int()
    .min(0)
    .default(0)
    .openapi({
      param: {
        name: "offset",
        in: "query",
        description: "Pagination offset (default 0)",
        example: 0,
      },
    }),
});

const nearbyPodLocationSchema = z.object({
  id: z.string(),
  name: z.string(),
  address: z.string().nullable(),
  locationType: z.string().nullable(),
  description: z.string().nullable(),
  latitude: z.string().nullable(),
  longitude: z.string().nullable(),
  zone: z
    .object({
      id: z.string(),
      name: z.string(),
      description: z.string().nullable(),
      region: z
        .object({
          id: z.string(),
          name: z.string(),
          description: z.string().nullable(),
        })
        .nullable(),
    })
    .nullable(),
});

const nearbyPodItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  type: z.string(),
  status: z.string(),
  rateConfig: z.array(z.record(z.string(), z.unknown())),
  locationId: z.string().nullable(),
  location: nearbyPodLocationSchema.nullable(),
  aromaDefusers: z.array(z.record(z.string(), z.unknown())),
  aromaDefuser: z.record(z.string(), z.unknown()).nullable(),
  isAvailable: z.boolean(),
  activeSession: z
    .object({
      id: z.string(),
      startAt: z.string(),
      endAt: z.string(),
      remainingSeconds: z.number(),
    })
    .nullable(),
  distanceKm: z.number().nullable(),
  distanceMeters: z.number().nullable(),
});

const nearbyPodsResponseSchema = z.object({
  items: z.array(nearbyPodItemSchema),
  total: z.number(),
  isFallback: z.boolean(),
  fallbackMessage: z.string().nullable(),
  limit: z.number(),
  offset: z.number(),
});

const appTags = ["App PWA"];

export const getNearbyPodsRoute = createOpenApiRoute({
  method: "get",
  path: "/pods/nearby",
  operationId: "ommpodsAppPodsNearby",
  tags: appTags,
  summary: "Find nearby OMMPods and search pods",
  description:
    "Returns pods with GPS proximity calculation (Haversine distanceKm and distanceMeters), multi-field search (city, airport, station, state), real-time availability, and smart regional fallback when no pods are within radius.",
  request: {
    query: nearbyPodsQuerySchema,
  },
  responses: {
    200: createApiSuccessResponse(nearbyPodsResponseSchema, "Nearby pods retrieved successfully"),
  },
});

export const getPodsRoute = createOpenApiRoute({
  method: "get",
  path: "/pods",
  operationId: "ommpodsAppPodsList",
  tags: appTags,
  summary: "List OMMPods for Mobile App (Alias for /pods/nearby)",
  description: "Search, filter, and find nearby pods for the mobile app.",
  request: {
    query: nearbyPodsQuerySchema,
  },
  responses: {
    200: createApiSuccessResponse(nearbyPodsResponseSchema, "Pods retrieved successfully"),
  },
});

function calculateHaversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
  const toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad;
  const dLon = (lon2 - lon1) * toRad;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100;
}

const handleGetNearbyPods = async (c: Context<AppBindings>) => {
  const queryResult = nearbyPodsQuerySchema.safeParse(c.req.query());
  if (!queryResult.success) {
    return c.json(
      createErrorResponse({
        error: "Bad Request",
        message: "Invalid query parameters.",
        details: queryResult.error.flatten(),
      }),
      400
    );
  }

  const {
    latitude: userLat,
    longitude: userLng,
    radiusKm,
    search,
    city,
    region: regionFilter,
    locationType: locationTypeFilter,
    podType,
    status,
    onlyAvailable,
    limit,
    offset,
  } = queryResult.data;

  const now = new Date();

  // 1. Fetch pods with full location hierarchy (location -> zone -> region)
  const podRecords = await db.query.pods.findMany({
    where: and(
      eq(pods.isDeleted, false),
      status
        ? eq(pods.status, status as (typeof OmmPodStatus.enumValues)[number])
        : eq(pods.status, "ACTIVE"),
      podType ? eq(pods.type, podType as (typeof OmmPodType.enumValues)[number]) : undefined
    ),
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

  // 2. Fetch active sessions to determine real-time availability
  const activeSessions = await db.query.podSessions.findMany({
    where: and(
      eq(podSessions.status, "CONFIRMED"),
      eq(podSessions.isDeleted, false),
      lte(podSessions.startAt, now),
      gt(podSessions.endAt, now)
    ),
    columns: {
      id: true,
      podId: true,
      startAt: true,
      endAt: true,
    },
  });

  const activeSessionByPodId = new Map(
    activeSessions.map((s) => [
      s.podId,
      {
        id: s.id,
        startAt: s.startAt.toISOString(),
        endAt: s.endAt.toISOString(),
        remainingSeconds: Math.max(0, Math.ceil((s.endAt.getTime() - now.getTime()) / 1000)),
      },
    ])
  );

  // 3. Search and text filter normalization
  const normalizedSearch = search?.toLowerCase().trim() ?? null;
  const searchWords = normalizedSearch ? normalizedSearch.split(/\s+/).filter(Boolean) : [];
  const normalizedCity = city?.toLowerCase().trim() ?? null;
  const normalizedRegion = regionFilter?.toLowerCase().trim() ?? null;
  const normalizedLocationType = locationTypeFilter?.toLowerCase().trim() ?? null;

  // 4. Map pods with coordinates, availability, and distance
  const hasUserCoordinates =
    typeof userLat === "number" &&
    typeof userLng === "number" &&
    Number.isFinite(userLat) &&
    Number.isFinite(userLng);

  const processedPods = podRecords.map((pod) => {
    const loc = pod.location;
    const activeSession = activeSessionByPodId.get(pod.id) ?? null;
    const isAvailable = pod.status === "ACTIVE" && activeSession === null;

    let distanceKm: number | null = null;
    let distanceMeters: number | null = null;

    if (hasUserCoordinates && loc?.latitude && loc?.longitude) {
      const pLat = Number.parseFloat(loc.latitude);
      const pLng = Number.parseFloat(loc.longitude);
      if (Number.isFinite(pLat) && Number.isFinite(pLng)) {
        distanceKm = calculateHaversineDistanceKm(userLat, userLng, pLat, pLng);
        distanceMeters = Math.round(distanceKm * 1000);
      }
    }

    return {
      pod,
      isAvailable,
      activeSession,
      distanceKm,
      distanceMeters,
    };
  });

  // Apply availability filter
  let filtered = processedPods;
  if (onlyAvailable) {
    filtered = filtered.filter((item) => item.isAvailable);
  }

  // Apply multi-field text search (city, airport, station, state, address, name)
  if (searchWords.length > 0 || normalizedCity || normalizedRegion || normalizedLocationType) {
    filtered = filtered.filter(({ pod }) => {
      const loc = pod.location;
      const zoneName = loc?.zone?.name ?? "";
      const regName = loc?.zone?.region?.name ?? "";
      const locName = loc?.name ?? "";
      const locAddress = loc?.address ?? "";
      const locType = loc?.locationType ?? "";
      const podName = pod.name ?? "";
      const podDesc = pod.description ?? "";

      // Multi-word search matching across all fields
      if (searchWords.length > 0) {
        const matchesAllWords = searchWords.every((word) =>
          [podName, podDesc, locName, locAddress, locType, zoneName, regName].some((field) =>
            field.toLowerCase().includes(word)
          )
        );
        if (!matchesAllWords) return false;
      }

      // City filter (checks zone name, address, or location name)
      if (normalizedCity) {
        const matchesCity =
          zoneName.toLowerCase().includes(normalizedCity) ||
          locAddress.toLowerCase().includes(normalizedCity) ||
          locName.toLowerCase().includes(normalizedCity);
        if (!matchesCity) return false;
      }

      // Region/State filter (checks region name, address, or zone name)
      if (normalizedRegion) {
        const matchesRegion =
          regName.toLowerCase().includes(normalizedRegion) ||
          locAddress.toLowerCase().includes(normalizedRegion) ||
          zoneName.toLowerCase().includes(normalizedRegion);
        if (!matchesRegion) return false;
      }

      // Location type filter (e.g. Airport, Station, Mall)
      if (normalizedLocationType) {
        const matchesType = locType.toLowerCase().includes(normalizedLocationType);
        if (!matchesType) return false;
      }

      return true;
    });
  }

  // 5. Proximity sorting & Fallback handling
  let isFallback = false;
  let fallbackMessage: string | null = null;
  let finalPods = filtered;

  if (hasUserCoordinates) {
    // Check which pods fall within radiusKm
    const withinRadius = filtered.filter(
      (item) => item.distanceKm !== null && item.distanceKm <= radiusKm
    );

    if (withinRadius.length > 0) {
      withinRadius.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
      finalPods = withinRadius;
      isFallback = false;
    } else if (filtered.length > 0) {
      // Fallback: No pods in immediate radius -> show closest available pods
      filtered.sort((a, b) => {
        if (a.distanceKm === null && b.distanceKm === null) return 0;
        if (a.distanceKm === null) return 1;
        if (b.distanceKm === null) return -1;
        return a.distanceKm - b.distanceKm;
      });
      finalPods = filtered;
      isFallback = true;
      fallbackMessage = `No pods found within ${radiusKm} km. Showing nearest available pods.`;
    }
  } else {
    // No coordinates: sort alphabetically by pod name
    filtered.sort((a, b) => a.pod.name.localeCompare(b.pod.name));
    finalPods = filtered;
  }

  // 6. Pagination
  const total = finalPods.length;
  const paginatedSlice = finalPods.slice(offset, offset + limit);

  // 7. Hydrate aroma diffusers and format response
  const items = await Promise.all(
    paginatedSlice.map(async (item) => {
      const hydratedPod = await hydratePodAromaDefusers(item.pod);
      const serialized = serializeAppPod(hydratedPod as AppPod);
      const loc = item.pod.location;

      return {
        ...serialized,
        isAvailable: item.isAvailable,
        activeSession: item.activeSession,
        distanceKm: item.distanceKm,
        distanceMeters: item.distanceMeters,
        location: loc
          ? {
              id: loc.id,
              name: loc.name,
              address: loc.address ?? null,
              locationType: loc.locationType ?? null,
              description: loc.description ?? null,
              latitude: loc.latitude ?? null,
              longitude: loc.longitude ?? null,
              zone: loc.zone
                ? {
                    id: loc.zone.id,
                    name: loc.zone.name,
                    description: loc.zone.description ?? null,
                    region: loc.zone.region
                      ? {
                          id: loc.zone.region.id,
                          name: loc.zone.region.name,
                          description: loc.zone.region.description ?? null,
                        }
                      : null,
                  }
                : null,
            }
          : null,
      };
    })
  );

  return c.json(
    createSuccessResponse({
      items,
      total,
      isFallback,
      fallbackMessage,
      limit,
      offset,
    }),
    200
  );
};

registerOpenApiRoute(appGroup, getNearbyPodsRoute, handleGetNearbyPods as never);
registerOpenApiRoute(appGroup, getPodsRoute, handleGetNearbyPods as never);

appGroup.get("/pods/:id", async (c) => {
  const podId = c.req.param("id");
  const podRecord = await db.query.pods.findFirst({
    where: and(eq(pods.id, podId), eq(pods.isDeleted, false)),
  });
  const pod = await hydratePodAromaDefusers(podRecord);

  if (!pod) {
    return c.json(createErrorResponse({ error: "Not Found", message: "Pod not found" }), 404);
  }

  return c.json(createSuccessResponse(serializeAppPod(pod)), 200);
});

appGroup.get("/moods/list", async (c) => {
  const podType = c.req.query("podType");
  const isKnownPodType = (value: string): value is (typeof OmmPodType.enumValues)[number] =>
    OmmPodType.enumValues.includes(value as (typeof OmmPodType.enumValues)[number]);

  if (podType && !isKnownPodType(podType)) {
    return c.json(createErrorResponse({ error: "Bad Request", message: "Invalid pod type" }), 400);
  }

  const moods = await db.query.podMoodPresets.findMany({
    where: and(
      eq(podMoodPresets.isDeleted, false),
      podType ? sql`${podType}::ommpod_type = ANY(${podMoodPresets.enabledPodTypes})` : undefined
    ),
    orderBy: (table, { asc }) => [asc(table.title)],
  });

  return c.json(createSuccessResponse(moods), 200);
});

appGroup.get("/playlists/list", async (c) => {
  const moodPresetId = c.req.query("moodPresetId");
  const moodPreset = moodPresetId
    ? await db.query.podMoodPresets.findFirst({
        where: and(eq(podMoodPresets.id, moodPresetId), eq(podMoodPresets.isDeleted, false)),
      })
    : null;
  const playlistIds = moodPreset?.playlistIds ?? [];

  if (moodPresetId && playlistIds.length === 0) {
    return c.json(createSuccessResponse([]), 200);
  }

  const playlists = await db.query.musicPlaylists.findMany({
    where: and(
      eq(musicPlaylists.isDeleted, false),
      playlistIds.length > 0 ? inArray(musicPlaylists.id, playlistIds) : undefined
    ),
    orderBy: (table, { asc }) => [asc(table.name)],
  });

  return c.json(createSuccessResponse(playlists), 200);
});

appGroup.get("/musics/list", async (c) => {
  const playlistId = c.req.query("playlistId");

  if (!playlistId) {
    return c.json(createSuccessResponse([]), 200);
  }

  const items = await db.query.musics.findMany({
    where: and(eq(musics.playlistId, playlistId), eq(musics.isDeleted, false)),
    orderBy: (table, { asc }) => [asc(table.name)],
  });

  return c.json(createSuccessResponse(items), 200);
});
