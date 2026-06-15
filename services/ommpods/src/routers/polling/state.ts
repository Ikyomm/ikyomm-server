import { logger } from "@/lib/logger";
import { db, podSessions } from "@ikyomm/database";
import { getRedisClient } from "@ikyomm/utils";
import { and, eq, gt, inArray } from "drizzle-orm";
import {
  DEFAULT_RGB,
  buildSessionEndingDelay,
  buildSessionResponse,
  buildSessionStartingDelay,
  findPodWithAromaDefuser,
  getSessionStartEndDelaySeconds,
  resolveSessionControlState,
  secondsBetween,
  secondsUntil,
} from "../shared";
import { broadcastPollingDataForPod } from "./realtime";
import { pollingResponseSchema, type PollingResponse } from "./schema";

const POLLING_REDIS_KEY_PREFIX = "ommpods:polling:pods";
const POLLING_REDIS_VERSION = 1;
const NO_SESSION_REDIS_TTL_SECONDS = 5;
const EXPIRED_SESSION_REDIS_TTL_SECONDS = 5;
const SESSION_REDIS_GRACE_SECONDS = 60;

type PodWithAromaDefuser = Awaited<ReturnType<typeof findPodWithAromaDefuser>>;
type PollingStateUpdateListener = (podId: string, data: PollingResponse) => void;

const pollingStateUpdateListeners = new Set<PollingStateUpdateListener>();

type CachedPollingSessionTiming = {
  id: string;
  podId: string;
  start: string;
  end: string;
  startAt: string;
  endAt: string;
  startingDelayTotalTime: number;
  endingDelayTotalTime: number;
};

type CachedPollingState = {
  version: typeof POLLING_REDIS_VERSION;
  podId: string;
  data: PollingResponse;
  sessionTiming: CachedPollingSessionTiming | null;
  storedAt: number;
};

function getPollingRedisKey(podId: string) {
  return `${POLLING_REDIS_KEY_PREFIX}:${podId}`;
}

export function subscribeToPollingStateUpdates(listener: PollingStateUpdateListener) {
  pollingStateUpdateListeners.add(listener);

  return () => {
    pollingStateUpdateListeners.delete(listener);
  };
}

function notifyPollingStateUpdated(podId: string, data: PollingResponse) {
  for (const listener of pollingStateUpdateListeners) {
    try {
      listener(podId, data);
    } catch (error) {
      logger.warn("failed to notify polling state listener", {
        podId,
        error,
      });
    }
  }
}

export function buildSafePollingData(): PollingResponse {
  return {
    podData: {
      connectedDeviceConfig: [],
      aromaDufuser: {
        defuserMacIds: [],
        activeDefuserMacId: null,
        activeDufuserContainerNumber: null,
      },
    },
    ...DEFAULT_RGB,
    sessionStartingDelay: null,
    sessionEndingDelay: null,
    session: null,
  };
}

function buildBasePodData(pod: PodWithAromaDefuser | null | undefined): PollingResponse["podData"] {
  const aromaDefusers = pod?.aromaDefusers ?? [];
  const defuserMacIds = aromaDefusers.map((aromaDefuser) => aromaDefuser.macId);

  return {
    connectedDeviceConfig: pod?.connectedDeviceConfig ?? [],
    aromaDufuser: {
      defuserMacIds,
      activeDefuserMacId: null,
      activeDufuserContainerNumber: null,
    },
  };
}

function getActiveDelay(
  delay: { totalTime: number; remaining: number } | null | undefined
): { totalTime: number; remaining: number } | null {
  if (!delay || delay.remaining <= 0) {
    return null;
  }

  return delay;
}

function buildPollingSessionTiming(
  session: typeof podSessions.$inferSelect,
  now: Date,
  pod: NonNullable<PodWithAromaDefuser>
): {
  data: Pick<PollingResponse, "session" | "sessionStartingDelay" | "sessionEndingDelay">;
  timing: CachedPollingSessionTiming;
} {
  const sessionResponse = buildSessionResponse(session, now, pod.location);
  const sessionEndingDelay = buildSessionEndingDelay(session.endAt, now);

  const sessionData = {
    id: sessionResponse.id,
    podId: sessionResponse.podId,
    start: sessionResponse.start,
    end: sessionResponse.end,
    remaining: sessionResponse.remaining,
  };

  return {
    data: {
      session: sessionData,
      sessionStartingDelay: sessionEndingDelay
        ? null
        : getActiveDelay(sessionResponse.sessionStartingDelay),
      sessionEndingDelay,
    },
    timing: {
      id: session.id,
      podId: session.podId,
      start: sessionResponse.start,
      end: sessionResponse.end,
      startAt: session.startAt.toISOString(),
      endAt: session.endAt.toISOString(),
      startingDelayTotalTime: buildSessionStartingDelay().totalTime,
      endingDelayTotalTime: getSessionStartEndDelaySeconds(),
    },
  };
}

function materializePollingState(state: CachedPollingState, now = new Date()): PollingResponse {
  const timing = state.sessionTiming;

  if (!timing) {
    return state.data;
  }

  const startAt = new Date(timing.startAt);
  const endAt = new Date(timing.endAt);
  const endVisibleUntil = new Date(endAt.getTime() + timing.endingDelayTotalTime * 1000);

  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
    return state.data;
  }

  if (now.getTime() >= endVisibleUntil.getTime()) {
    return {
      podData: {
        ...state.data.podData,
        aromaDufuser: {
          ...state.data.podData.aromaDufuser,
          activeDefuserMacId: null,
          activeDufuserContainerNumber: null,
        },
      },
      ...DEFAULT_RGB,
      sessionStartingDelay: null,
      sessionEndingDelay: null,
      session: null,
    };
  }

  const startsIn = secondsUntil(startAt, now);
  const remaining = startsIn > 0 ? secondsBetween(startAt, endAt) : secondsUntil(endAt, now);
  const sessionEndingDelay = buildSessionEndingDelay(endAt, now);
  const sessionStartingDelay =
    startsIn > 0 && !sessionEndingDelay
      ? getActiveDelay({
          totalTime: timing.startingDelayTotalTime,
          remaining: Math.min(timing.startingDelayTotalTime, startsIn),
        })
      : null;

  return {
    ...state.data,
    sessionStartingDelay,
    sessionEndingDelay,
    session: {
      id: timing.id,
      podId: timing.podId,
      start: timing.start,
      end: timing.end,
      remaining,
    },
  };
}

function buildCachedPollingState(
  podId: string,
  data: PollingResponse,
  timing: CachedPollingSessionTiming | null
): CachedPollingState {
  return {
    version: POLLING_REDIS_VERSION,
    podId,
    data,
    sessionTiming: timing,
    storedAt: Date.now(),
  };
}

function getPollingStateTtlSeconds(state: CachedPollingState, now = new Date()) {
  if (!state.sessionTiming) {
    return NO_SESSION_REDIS_TTL_SECONDS;
  }

  const endAt = new Date(state.sessionTiming.endAt);
  if (Number.isNaN(endAt.getTime())) {
    return EXPIRED_SESSION_REDIS_TTL_SECONDS;
  }

  const expiresAt =
    endAt.getTime() +
    (state.sessionTiming.endingDelayTotalTime + SESSION_REDIS_GRACE_SECONDS) * 1000;
  const ttlSeconds = Math.ceil((expiresAt - now.getTime()) / 1000);

  return Math.max(EXPIRED_SESSION_REDIS_TTL_SECONDS, ttlSeconds);
}

async function writePollingStateToRedis(state: CachedPollingState) {
  const redis = getRedisClient();
  await redis.set(
    getPollingRedisKey(state.podId),
    JSON.stringify(state),
    "EX",
    getPollingStateTtlSeconds(state)
  );
}

async function persistPollingState(state: CachedPollingState) {
  try {
    await writePollingStateToRedis(state);
  } catch (error) {
    logger.warn("failed to persist polling state to redis", {
      podId: state.podId,
      error,
    });
  }
}

function parseCachedPollingState(value: string | null, podId: string): CachedPollingState | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as CachedPollingState;
    const data = pollingResponseSchema.safeParse(parsed.data);

    if (parsed.version !== POLLING_REDIS_VERSION || parsed.podId !== podId || !data.success) {
      return null;
    }

    return {
      ...parsed,
      data: data.data,
    };
  } catch {
    return null;
  }
}

export async function readPollingDataFromRedis(podId: string): Promise<PollingResponse | null> {
  try {
    const redis = getRedisClient();
    const state = parseCachedPollingState(await redis.get(getPollingRedisKey(podId)), podId);

    if (!state) {
      return null;
    }

    const data = materializePollingState(state);
    await writePollingStateToRedis({
      ...state,
      data,
      storedAt: Date.now(),
    });

    return data;
  } catch (error) {
    logger.warn("failed to read polling state from redis", {
      podId,
      error,
    });
    return null;
  }
}

export async function refreshPollingDataForPod(podId: string): Promise<PollingResponse> {
  const pod = await findPodWithAromaDefuser(podId);
  const now = new Date();
  const basePodData = buildBasePodData(pod);

  if (!pod) {
    const data = {
      podData: basePodData,
      ...DEFAULT_RGB,
      sessionStartingDelay: null,
      sessionEndingDelay: null,
      session: null,
    };

    await persistPollingState(buildCachedPollingState(podId, data, null));
    broadcastPollingDataForPod(podId, data);
    notifyPollingStateUpdated(podId, data);
    return data;
  }

  const sessionEndWindowStart = new Date(now.getTime() - getSessionStartEndDelaySeconds() * 1000);

  const session = await db.query.podSessions.findFirst({
    where: and(
      eq(podSessions.podId, pod.id),
      inArray(podSessions.status, ["CONFIRMED", "CANCELLED", "EMERGENCY_UNLOCKED"]),
      eq(podSessions.isDeleted, false),
      gt(podSessions.endAt, sessionEndWindowStart)
    ),
    orderBy: (table, { asc }) => [asc(table.endAt)],
  });

  if (!session) {
    const data = {
      podData: basePodData,
      ...DEFAULT_RGB,
      sessionStartingDelay: null,
      sessionEndingDelay: null,
      session: null,
    };

    await persistPollingState(buildCachedPollingState(podId, data, null));
    broadcastPollingDataForPod(podId, data);
    notifyPollingStateUpdated(podId, data);
    return data;
  }

  const controlState = await resolveSessionControlState(session.id);
  const rgb = controlState.rgb;
  const sessionResponse = buildPollingSessionTiming(session, now, pod);
  const activeAromaDefuser =
    pod.aromaDefusers.find(
      (aromaDefuser) => aromaDefuser.id === controlState.activeAromaDefuserId
    ) ?? null;
  const data = {
    podData: {
      ...basePodData,
      aromaDufuser: {
        ...basePodData.aromaDufuser,
        activeDefuserMacId: activeAromaDefuser?.macId ?? null,
        activeDufuserContainerNumber: controlState.activeDufuserContainerNumber,
      },
    },
    r: rgb.r,
    g: rgb.g,
    b: rgb.b,
    sessionStartingDelay: sessionResponse.data.sessionStartingDelay,
    sessionEndingDelay: sessionResponse.data.sessionEndingDelay,
    session: sessionResponse.data.session,
  };

  await persistPollingState(buildCachedPollingState(podId, data, sessionResponse.timing));
  broadcastPollingDataForPod(podId, data);
  notifyPollingStateUpdated(podId, data);
  return data;
}
