import { logger } from "@/lib/logger";
import { db, podSessions } from "@ikyomm/database";
import { getRedisClient } from "@ikyomm/utils";
import { and, eq, gt, inArray } from "drizzle-orm";
import {
  buildSessionEndingDelay,
  buildSessionResponse,
  buildSessionStartingDelay,
  findPodWithAromaDefuser,
  getSessionStartEndDelaySeconds,
  resolveSessionControlState,
  secondsBetween,
  secondsUntil,
} from "@/routers/shared";
import { podStateSchema, type PodState } from "./schema";

const POD_STATE_REDIS_KEY_PREFIX = "ommpods:pods:state";
const POD_STATE_VERSION = 1;
const NO_SESSION_REDIS_TTL_SECONDS = 5;
const EXPIRED_SESSION_REDIS_TTL_SECONDS = 5;
const SESSION_REDIS_GRACE_SECONDS = 60;
const IDLE_RGB = { r: 0, g: 0, b: 0 };
const DELAY_RGB = { r: 255, g: 255, b: 255 };

type PodWithAromaDefuser = Awaited<ReturnType<typeof findPodWithAromaDefuser>>;
type PodStateUpdateListener = (podId: string, data: PodState) => void;

type CachedSessionTiming = {
  id: string;
  podId: string;
  start: string;
  end: string;
  startAt: string;
  endAt: string;
  startingDelayTotalTime: number;
  endingDelayTotalTime: number;
};

type CachedPodState = {
  version: typeof POD_STATE_VERSION;
  podId: string;
  data: PodState;
  sessionTiming: CachedSessionTiming | null;
  storedAt: number;
};

const podStateUpdateListeners = new Set<PodStateUpdateListener>();

function getRedisKey(podId: string) {
  return `${POD_STATE_REDIS_KEY_PREFIX}:${podId}`;
}

export function subscribeToPodStateUpdates(listener: PodStateUpdateListener) {
  podStateUpdateListeners.add(listener);

  return () => {
    podStateUpdateListeners.delete(listener);
  };
}

function notifyPodStateUpdated(podId: string, data: PodState) {
  for (const listener of podStateUpdateListeners) {
    try {
      listener(podId, data);
    } catch (error) {
      logger.warn("failed to notify pod state listener", {
        podId,
        error,
      });
    }
  }
}

function applyRgbState(data: PodState): PodState {
  if (data.sessionStartingDelay || data.sessionEndingDelay) {
    return {
      ...data,
      ...DELAY_RGB,
    };
  }

  if (!data.session) {
    return {
      ...data,
      ...IDLE_RGB,
    };
  }

  return data;
}

export function buildSafePodState(): PodState {
  return {
    podData: {
      connectedDeviceConfig: [],
      aromaDufuser: {
        defuserMacIds: [],
        activeDefuserMacId: null,
        activeDufuserContainerNumber: null,
      },
    },
    ...IDLE_RGB,
    moodPresetId: null,
    musicControl: null,
    sessionStartingDelay: null,
    sessionEndingDelay: null,
    session: null,
  };
}

function buildBasePodData(pod: PodWithAromaDefuser | null | undefined): PodState["podData"] {
  const aromaDefusers = pod?.aromaDefusers ?? [];

  return {
    connectedDeviceConfig: pod?.connectedDeviceConfig ?? [],
    aromaDufuser: {
      defuserMacIds: aromaDefusers.map((aromaDefuser) => aromaDefuser.macId),
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

function buildSessionTiming(
  session: typeof podSessions.$inferSelect,
  now: Date,
  pod: NonNullable<PodWithAromaDefuser>
): {
  data: Pick<PodState, "session" | "sessionStartingDelay" | "sessionEndingDelay">;
  timing: CachedSessionTiming;
} {
  const sessionResponse = buildSessionResponse(session, now, pod.location);
  const sessionEndingDelay = buildSessionEndingDelay(session.endAt, now);

  return {
    data: {
      session: {
        id: sessionResponse.id,
        podId: sessionResponse.podId,
        start: sessionResponse.start,
        end: sessionResponse.end,
        remaining: sessionResponse.remaining,
      },
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

function materializePodState(state: CachedPodState, now = new Date()): PodState {
  const timing = state.sessionTiming;

  if (!timing) {
    return applyRgbState(state.data);
  }

  const startAt = new Date(timing.startAt);
  const endAt = new Date(timing.endAt);
  const endVisibleUntil = new Date(endAt.getTime() + timing.endingDelayTotalTime * 1000);

  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
    return applyRgbState(state.data);
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
      ...IDLE_RGB,
      moodPresetId: null,
      musicControl: null,
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

  return applyRgbState({
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
  });
}

function buildCachedPodState(
  podId: string,
  data: PodState,
  timing: CachedSessionTiming | null
): CachedPodState {
  return {
    version: POD_STATE_VERSION,
    podId,
    data,
    sessionTiming: timing,
    storedAt: Date.now(),
  };
}

function getRedisTtlSeconds(state: CachedPodState, now = new Date()) {
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

  return Math.max(EXPIRED_SESSION_REDIS_TTL_SECONDS, Math.ceil((expiresAt - now.getTime()) / 1000));
}

async function writePodStateToRedis(state: CachedPodState) {
  const redis = getRedisClient();
  await redis.set(getRedisKey(state.podId), JSON.stringify(state), "EX", getRedisTtlSeconds(state));
}

async function persistPodState(state: CachedPodState) {
  try {
    await writePodStateToRedis(state);
  } catch (error) {
    logger.warn("failed to persist pod state to redis", {
      podId: state.podId,
      error,
    });
  }
}

function parseCachedPodState(value: string | null, podId: string): CachedPodState | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as CachedPodState;
    const data = podStateSchema.safeParse(parsed.data);

    if (parsed.version !== POD_STATE_VERSION || parsed.podId !== podId || !data.success) {
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

export async function readPodStateFromRedis(podId: string): Promise<PodState | null> {
  try {
    const redis = getRedisClient();
    const state = parseCachedPodState(await redis.get(getRedisKey(podId)), podId);

    if (!state) {
      return null;
    }

    const data = materializePodState(state);
    await writePodStateToRedis({
      ...state,
      storedAt: Date.now(),
    });
    notifyPodStateUpdated(podId, data);

    return data;
  } catch (error) {
    logger.warn("failed to read pod state from redis", {
      podId,
      error,
    });
    return null;
  }
}

export async function refreshPodStateForPod(podId: string): Promise<PodState> {
  const pod = await findPodWithAromaDefuser(podId);
  const now = new Date();
  const basePodData = buildBasePodData(pod);

  if (!pod) {
    const data = {
      podData: basePodData,
      ...IDLE_RGB,
      moodPresetId: null,
      musicControl: null,
      sessionStartingDelay: null,
      sessionEndingDelay: null,
      session: null,
    };

    await persistPodState(buildCachedPodState(podId, data, null));
    notifyPodStateUpdated(podId, data);
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
      ...IDLE_RGB,
      moodPresetId: null,
      musicControl: null,
      sessionStartingDelay: null,
      sessionEndingDelay: null,
      session: null,
    };

    await persistPodState(buildCachedPodState(podId, data, null));
    notifyPodStateUpdated(podId, data);
    return data;
  }

  const controlState = await resolveSessionControlState(session.id, {
    aromaDefusers: pod.aromaDefusers,
  });
  const sessionState = buildSessionTiming(session, now, pod);
  const activeAromaDefuser =
    pod.aromaDefusers.find(
      (aromaDefuser) => aromaDefuser.id === controlState.activeAromaDefuserId
    ) ?? null;
  const data = applyRgbState({
    podData: {
      ...basePodData,
      aromaDufuser: {
        ...basePodData.aromaDufuser,
        activeDefuserMacId: activeAromaDefuser?.macId ?? null,
        activeDufuserContainerNumber: controlState.activeDufuserContainerNumber,
      },
    },
    r: controlState.rgb.r,
    g: controlState.rgb.g,
    b: controlState.rgb.b,
    moodPresetId: controlState.moodPresetId,
    musicControl: controlState.musicControl,
    sessionStartingDelay: sessionState.data.sessionStartingDelay,
    sessionEndingDelay: sessionState.data.sessionEndingDelay,
    session: sessionState.data.session,
  });

  await persistPodState(buildCachedPodState(podId, data, sessionState.timing));
  notifyPodStateUpdated(podId, data);
  return data;
}
