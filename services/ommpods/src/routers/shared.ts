import { z } from "@hono/zod-openapi";
import { env } from "@/config/env";
import {
  db,
  podMoodPresets,
  podSessionLogs,
  podSessions,
  pods,
  type PodSessionRgb,
} from "@ikyomm/database";
import type { zoneLocation } from "@ikyomm/database";
import type { aromaDefusers } from "@ikyomm/database";
import { and, desc, eq, gt } from "drizzle-orm";

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
});

export const activeSessionParamsSchema = z.object({
  sessionId: z.string().trim().min(1),
});

export const messageResponseSchema = z.object({
  message: z.string(),
});

export const DEFAULT_RGB: PodSessionRgb = { r: 255, g: 255, b: 255 };

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
  return (
    getSessionStartEndDelaySeconds() + Math.max(0, env.SESSION_START_INTRODUCTORY_VIDEO_DURATION)
  );
}

export function buildSessionStartingDelay(remaining = 0) {
  const totalTime = getSessionStartingDelaySeconds();

  return {
    totalTime,
    remaining: Math.min(totalTime, Math.max(0, remaining)),
  };
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
  };
}

export async function findActiveSessionForUser(sessionId: string, userId: string) {
  return db.query.podSessions.findFirst({
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
          aromaDefuser: true,
          location: true,
        },
      },
    },
  });
}

export async function findPodWithAromaDefuser(podId: string) {
  return db.query.pods.findFirst({
    where: and(eq(pods.id, podId), eq(pods.isDeleted, false)),
    with: {
      aromaDefuser: true,
      location: true,
    },
  });
}

export function findContainer(
  aromaDefuser: typeof aromaDefusers.$inferSelect | null | undefined,
  containerNumber: number
) {
  return (aromaDefuser?.containers ?? []).find((container) => container.number === containerNumber);
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

export async function resolveSessionControlState(sessionId: string) {
  const [moodLogs, aromaLogs] = await Promise.all([
    db
      .select({
        payload: podSessionLogs.payload,
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
  ]);

  const latestMoodLog = moodLogs[0];
  const latestAromaLog = aromaLogs[0];
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
        },
      })
    : null;

  return {
    rgb: moodPreset?.rgb ?? DEFAULT_RGB,
    moodPresetId: moodPreset?.id ?? null,
    activeDufuserContainerNumber: getAromaContainerFromPayload(latestAromaLog?.payload),
  };
}
