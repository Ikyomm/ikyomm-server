import { z } from "@hono/zod-openapi";
import { env } from "@/config/env";
import {
  type AromaDefuserContainerType,
  aromaDefusers,
  db,
  podMoodPresets,
  podSessionLogs,
  podSessions,
  pods,
  type PodSessionRgb,
} from "@ikyomm/database";
import type { zoneLocation } from "@ikyomm/database";
import { and, desc, eq, gt, inArray } from "drizzle-orm";

export const rgbSchema = z.object({
  r: z.number().int().min(0).max(255),
  g: z.number().int().min(0).max(255),
  b: z.number().int().min(0).max(255),
});

export const sessionResponseSchema = z.object({
  id: z.string(),
  podId: z.string(),
  start: z.string(),
  end: z.string(),
  remaining: z.number().int().min(0),
  startsIn: z.number().int().min(0),
  sessionStartingDelay: z.object({
    totalTime: z.number().int().min(0),
    remaining: z.number().int().min(0),
  }),
  sessionEndingDelay: z
    .object({
      totalTime: z.number().int().min(0),
      remaining: z.number().int().min(0),
    })
    .nullable(),
});

export const activeSessionParamsSchema = z.object({
  sessionId: z.string().trim().min(1),
});

export const messageResponseSchema = z.object({
  message: z.string(),
});

export const DEFAULT_RGB: PodSessionRgb = { r: 255, g: 255, b: 255 };
export const DEFAULT_MUSIC_VOLUME = 0.72;
type AromaDefuserRecord = typeof aromaDefusers.$inferSelect;
type HydratedAromaPod<TPod extends Record<string, unknown>> = TPod & {
  aromaDefusers: AromaDefuserRecord[];
  aromaDefuser: AromaDefuserRecord | null;
};

type PodLocationTimeZoneInput =
  | Pick<typeof zoneLocation.$inferSelect, "name" | "address" | "latitude" | "longitude">
  | null
  | undefined;

const cityTimeZones: Array<{ pattern: RegExp; timeZone: string }> = [
  { pattern: /\b(kolkata|calcutta)\b/i, timeZone: "Asia/Kolkata" },
  {
    pattern:
      /\b(mumbai|delhi|new delhi|bengaluru|bangalore|chennai|hyderabad|pune|ahmedabad|kochi|cochin|goa|jaipur)\b/i,
    timeZone: "Asia/Kolkata",
  },
  { pattern: /\b(dubai|abu dhabi|sharjah)\b/i, timeZone: "Asia/Dubai" },
  { pattern: /\b(singapore)\b/i, timeZone: "Asia/Singapore" },
  { pattern: /\b(doha)\b/i, timeZone: "Asia/Qatar" },
  { pattern: /\b(riyadh|jeddah)\b/i, timeZone: "Asia/Riyadh" },
  { pattern: /\b(london)\b/i, timeZone: "Europe/London" },
  { pattern: /\b(new york|nyc)\b/i, timeZone: "America/New_York" },
  { pattern: /\b(los angeles|la)\b/i, timeZone: "America/Los_Angeles" },
];

function toCoordinate(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const coordinate = Number(value);
  return Number.isFinite(coordinate) ? coordinate : null;
}

function getTimeZoneFromCoordinates(latitude: number | null, longitude: number | null) {
  if (latitude === null || longitude === null) {
    return null;
  }

  if (latitude >= 6 && latitude <= 38 && longitude >= 68 && longitude <= 98) {
    return "Asia/Kolkata";
  }

  if (latitude >= 22 && latitude <= 27 && longitude >= 51 && longitude <= 57) {
    return "Asia/Dubai";
  }

  if (latitude >= 1 && latitude <= 2 && longitude >= 103 && longitude <= 105) {
    return "Asia/Singapore";
  }

  if (latitude >= 24 && latitude <= 50 && longitude >= -125 && longitude <= -66) {
    if (longitude <= -114) return "America/Los_Angeles";
    if (longitude <= -101) return "America/Denver";
    if (longitude <= -86) return "America/Chicago";
    return "America/New_York";
  }

  return null;
}

export function getPodLocationTimeZone(location?: PodLocationTimeZoneInput) {
  const locationText = [location?.name, location?.address].filter(Boolean).join(" ");
  const matchedCity = cityTimeZones.find((entry) => entry.pattern.test(locationText));
  if (matchedCity) {
    return matchedCity.timeZone;
  }

  return (
    getTimeZoneFromCoordinates(
      toCoordinate(location?.latitude ?? null),
      toCoordinate(location?.longitude ?? null)
    ) ?? "UTC"
  );
}

export function formatDateTimeInTimeZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  })
    .formatToParts(date)
    .reduce<Record<string, string>>((acc, part) => {
      if (part.type !== "literal") {
        acc[part.type] = part.value;
      }
      return acc;
    }, {});

  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}

export function secondsUntil(target: Date, now = new Date()) {
  return Math.max(0, Math.ceil((target.getTime() - now.getTime()) / 1000));
}

export function secondsBetween(start: Date, end: Date) {
  return Math.max(0, Math.ceil((end.getTime() - start.getTime()) / 1000));
}

export function calculateSessionTiming(input: {
  startAt: Date;
  endAt: Date;
  now?: Date;
  startingDelayTotalTime?: number;
}) {
  const now = input.now ?? new Date();
  const startsIn = secondsUntil(input.startAt, now);
  const sessionDuration = secondsBetween(input.startAt, input.endAt);
  const sessionRemaining = startsIn > 0 ? sessionDuration : secondsUntil(input.endAt, now);
  const startingDelayTotalTime = Math.max(0, input.startingDelayTotalTime ?? 0);

  return {
    startsIn,
    remaining: sessionRemaining,
    sessionStartingDelay: {
      totalTime: startingDelayTotalTime,
      remaining: Math.min(startingDelayTotalTime, startsIn),
    },
  };
}

export function getSessionStartEndDelaySeconds() {
  return Math.max(0, env.SESSION_START_END_DELAY_SECONDS);
}

export function getSessionStartingDelaySeconds() {
  // Prep matches the intro video only. Door grace uses SESSION_START_END_DELAY
  // at session end so paid remaining does not shrink during the video.
  return Math.max(0, env.SESSION_START_INTRODUCTORY_VIDEO_DURATION);
}

export function buildSessionStartingDelay(remaining = 0) {
  const totalTime = getSessionStartingDelaySeconds();

  return {
    totalTime,
    remaining: Math.min(totalTime, Math.max(0, remaining)),
  };
}

export function buildSessionEndingDelay(endAt: Date, now = new Date()) {
  const totalTime = getSessionStartEndDelaySeconds();

  if (totalTime <= 0 || now.getTime() < endAt.getTime()) {
    return null;
  }

  const remaining = Math.min(
    totalTime,
    secondsUntil(new Date(endAt.getTime() + totalTime * 1000), now)
  );

  return remaining > 0 ? { totalTime, remaining } : null;
}

export function buildSessionResponse(
  session: typeof podSessions.$inferSelect,
  now = new Date(),
  location?: PodLocationTimeZoneInput
) {
  const timeZone = getPodLocationTimeZone(location);
  const timing = calculateSessionTiming({
    startAt: session.startAt,
    endAt: session.endAt,
    now,
    startingDelayTotalTime: getSessionStartingDelaySeconds(),
  });

  return {
    id: session.id,
    podId: session.podId,
    start: formatDateTimeInTimeZone(session.startAt, timeZone),
    end: formatDateTimeInTimeZone(session.endAt, timeZone),
    ...timing,
    sessionEndingDelay: buildSessionEndingDelay(session.endAt, now),
  };
}

export async function findActiveSessionForUser(sessionId: string, userId: string) {
  const session = await db.query.podSessions.findFirst({
    where: and(
      eq(podSessions.id, sessionId),
      eq(podSessions.userId, userId),
      eq(podSessions.status, "CONFIRMED"),
      eq(podSessions.isDeleted, false),
      gt(podSessions.endAt, new Date())
    ),
    with: {
      pod: {
        with: {
          location: true,
        },
      },
    },
  });

  if (!session?.pod) {
    return session;
  }

  return {
    ...session,
    pod: await hydratePodAromaDefusers(session.pod),
  };
}

export async function findPodWithAromaDefuser(podId: string) {
  const pod = await db.query.pods.findFirst({
    where: and(eq(pods.id, podId), eq(pods.isDeleted, false)),
    with: {
      location: true,
    },
  });

  return hydratePodAromaDefusers(pod);
}

export async function findAromaDefusersByIds(aromaDefuserIds: string[] = []) {
  const uniqueIds = [...new Set(aromaDefuserIds.filter(Boolean))];

  if (uniqueIds.length === 0) {
    return [];
  }

  const rows = await db
    .select()
    .from(aromaDefusers)
    .where(and(inArray(aromaDefusers.id, uniqueIds), eq(aromaDefusers.isDeleted, false)));
  const rowById = new Map(rows.map((row) => [row.id, row]));

  return uniqueIds
    .map((id) => rowById.get(id))
    .filter((row): row is (typeof rows)[number] => Boolean(row));
}

export async function hydratePodAromaDefusers<TPod extends Record<string, unknown>>(
  pod: TPod | null | undefined
): Promise<HydratedAromaPod<TPod> | null | undefined> {
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

export function findContainer(
  aromaDefuser: typeof aromaDefusers.$inferSelect | null | undefined,
  containerNumber: number
) {
  return (aromaDefuser?.containers ?? []).find((container) => container.number === containerNumber);
}

export function findFirstAromaContainerByType(
  aromaDefusersList: Array<typeof aromaDefusers.$inferSelect> = [],
  containerType: AromaDefuserContainerType | null | undefined
) {
  if (!containerType) {
    return null;
  }

  for (const aromaDefuser of aromaDefusersList) {
    const container = (aromaDefuser.containers ?? []).find((item) => item.type === containerType);

    if (container) {
      return { aromaDefuser, container };
    }
  }

  return null;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getAromaContainerFromPayload(payload: unknown) {
  if (!isObject(payload)) {
    return null;
  }

  const value = payload.activeDufuserContainerNumber;
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;
}

function getAromaDefuserIdFromPayload(payload: unknown) {
  if (!isObject(payload)) {
    return null;
  }

  const value = payload.activeAromaDefuserId;
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function isExplicitAromaOffPayload(payload: unknown) {
  return (
    isObject(payload) &&
    "activeDufuserContainerNumber" in payload &&
    payload.activeDufuserContainerNumber === null
  );
}

function getStringFromPayload(payload: Record<string, unknown> | null, key: string) {
  const value = payload?.[key];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function getNumberFromPayload(
  payload: Record<string, unknown> | null,
  key: string,
  fallback: number
) {
  const value = payload?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function getMusicControlFromPayload(payload: unknown) {
  const data = isObject(payload) ? (payload as Record<string, unknown>) : null;
  if (!data) {
    return null;
  }

  const playbackState: "playing" | "paused" =
    data.playbackState === "paused" ? "paused" : "playing";
  const outputSource: "speaker" | "bluetooth" =
    data.outputSource === "bluetooth" ? "bluetooth" : "speaker";
  const volume = Math.min(
    1,
    Math.max(0, getNumberFromPayload(data, "volume", DEFAULT_MUSIC_VOLUME))
  );

  return {
    playlistId: getStringFromPayload(data, "playlistId"),
    musicId: getStringFromPayload(data, "musicId"),
    playbackState,
    positionSeconds: Math.max(0, getNumberFromPayload(data, "positionSeconds", 0)),
    volume,
    outputSource,
    updatedAt: getStringFromPayload(data, "updatedAt") ?? new Date(0).toISOString(),
    nonce: getStringFromPayload(data, "nonce") ?? "",
  };
}

function isMissingMusicChangedEnumError(error: unknown) {
  return (
    error instanceof Error &&
    error.message.includes("MUSIC_CHANGED") &&
    error.message.includes("pod_session_log")
  );
}

export async function resolveSessionControlState(
  sessionId: string,
  options: { aromaDefusers?: Array<typeof aromaDefusers.$inferSelect> } = {}
) {
  const [moodLogs, aromaLogs, musicLogs] = await Promise.all([
    db
      .select({
        payload: podSessionLogs.payload,
        occurredAt: podSessionLogs.occurredAt,
      })
      .from(podSessionLogs)
      .where(
        and(
          eq(podSessionLogs.sessionId, sessionId),
          eq(podSessionLogs.eventType, "MOOD_CHANGED"),
          eq(podSessionLogs.isDeleted, false)
        )
      )
      .orderBy(desc(podSessionLogs.occurredAt))
      .limit(1),
    db
      .select({
        payload: podSessionLogs.payload,
        occurredAt: podSessionLogs.occurredAt,
      })
      .from(podSessionLogs)
      .where(
        and(
          eq(podSessionLogs.sessionId, sessionId),
          eq(podSessionLogs.eventType, "AROMA_CHANGED"),
          eq(podSessionLogs.isDeleted, false)
        )
      )
      .orderBy(desc(podSessionLogs.occurredAt))
      .limit(1),
    db
      .select({
        payload: podSessionLogs.payload,
      })
      .from(podSessionLogs)
      .where(
        and(
          eq(podSessionLogs.sessionId, sessionId),
          eq(podSessionLogs.eventType, "MUSIC_CHANGED"),
          eq(podSessionLogs.isDeleted, false)
        )
      )
      .orderBy(desc(podSessionLogs.occurredAt))
      .limit(1)
      .catch((error) => {
        if (isMissingMusicChangedEnumError(error)) {
          return [];
        }

        throw error;
      }),
  ]);

  const latestMoodLog = moodLogs[0];
  const latestAromaLog = aromaLogs[0];
  const latestMusicLog = musicLogs[0];
  const latestMoodPayload: Record<string, unknown> | null = isObject(latestMoodLog?.payload)
    ? (latestMoodLog.payload as Record<string, unknown>)
    : null;
  const moodPresetId =
    latestMoodPayload && typeof latestMoodPayload.moodPresetId === "string"
      ? latestMoodPayload.moodPresetId
      : null;
  const moodPreset = moodPresetId
    ? await db.query.podMoodPresets.findFirst({
        where: and(eq(podMoodPresets.id, moodPresetId), eq(podMoodPresets.isDeleted, false)),
        columns: {
          id: true,
          rgb: true,
          aromaDefuserContainerType: true,
        },
      })
    : null;
  const hasAromaOverrideAfterMood =
    Boolean(latestAromaLog) &&
    (!latestMoodLog || latestAromaLog.occurredAt.getTime() >= latestMoodLog.occurredAt.getTime());
  const explicitAromaOff =
    hasAromaOverrideAfterMood && isExplicitAromaOffPayload(latestAromaLog?.payload);
  const aromaOverride =
    hasAromaOverrideAfterMood && !explicitAromaOff
      ? {
          activeAromaDefuserId: getAromaDefuserIdFromPayload(latestAromaLog?.payload),
          activeDufuserContainerNumber: getAromaContainerFromPayload(latestAromaLog?.payload),
        }
      : null;
  const resolvedAroma = explicitAromaOff
    ? null
    : aromaOverride?.activeAromaDefuserId && aromaOverride.activeDufuserContainerNumber
      ? aromaOverride
      : (() => {
          const matched = findFirstAromaContainerByType(
            options.aromaDefusers ?? [],
            moodPreset?.aromaDefuserContainerType
          );

          return matched
            ? {
                activeAromaDefuserId: matched.aromaDefuser.id,
                activeDufuserContainerNumber: matched.container.number,
              }
            : null;
        })();

  return {
    rgb: moodPreset?.rgb ?? DEFAULT_RGB,
    moodPresetId: moodPreset?.id ?? null,
    activeAromaDefuserId: resolvedAroma?.activeAromaDefuserId ?? null,
    activeDufuserContainerNumber: resolvedAroma?.activeDufuserContainerNumber ?? null,
    musicControl: getMusicControlFromPayload(latestMusicLog?.payload),
  };
}
