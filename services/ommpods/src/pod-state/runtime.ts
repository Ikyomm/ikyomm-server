import { randomUUID } from "node:crypto";
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
const POD_ACTIVE_SET_REDIS_KEY = "ommpods:pods:active";
const POD_DIRTY_SET_REDIS_KEY = "ommpods:pods:dirty";
const POD_TICKER_LEADER_LOCK_REDIS_KEY = "ommpods:pods:ticker:leader";
const POD_STATE_VERSION = 1;
const NO_SESSION_REDIS_TTL_SECONDS = 5;
const EXPIRED_SESSION_REDIS_TTL_SECONDS = 5;
const SESSION_REDIS_GRACE_SECONDS = 60;
const POD_TICKER_LEADER_LOCK_TTL_SECONDS = 5;
const POD_TICKER_LEADER_RENEW_INTERVAL_MS = 2_000;
const IDLE_RGB = { r: 0, g: 0, b: 0 };
const DELAY_RGB = { r: 255, g: 255, b: 255 };
const POD_TICKER_INSTANCE_ID = randomUUID();
const RENEW_LEADER_LOCK_LUA = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("expire", KEYS[1], ARGV[2])
end
return 0
`;
const RELEASE_LEADER_LOCK_LUA = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
end
return 0
`;

type PodWithAromaDefuser = Awaited<ReturnType<typeof findPodWithAromaDefuser>>;
type PodStateUpdateListener = (podId: string, data: PodState) => void;
type ReadPodStateOptions = {
  notifyListeners?: boolean;
  syncRedisState?: boolean;
};
type RefreshPodStateOptions = {
  markDirty?: boolean;
  notifyListeners?: boolean;
};

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
let activePodTicker: ReturnType<typeof setTimeout> | null = null;
let tickerLeaderRenewTimer: ReturnType<typeof setInterval> | null = null;
let isTickingActivePods = false;
let isPodStateTickerInitialized = false;
let isPodStateTickerLeader = false;
let isRenewingTickerLeader = false;

function getRedisKey(podId: string) {
  return `${POD_STATE_REDIS_KEY_PREFIX}:${podId}`;
}

export function subscribeToPodStateUpdates(listener: PodStateUpdateListener) {
  podStateUpdateListeners.add(listener);

  return () => {
    podStateUpdateListeners.delete(listener);
  };
}

function hasLivePodState(data: PodState) {
  return Boolean(data.session || data.sessionStartingDelay || data.sessionEndingDelay);
}

async function syncRedisPodActivity(podId: string, data: PodState, markDirty = false) {
  const redis = getRedisClient();
  const command = redis.multi();

  if (hasLivePodState(data)) {
    command.sadd(POD_ACTIVE_SET_REDIS_KEY, podId);
  } else {
    command.srem(POD_ACTIVE_SET_REDIS_KEY, podId);
  }

  if (markDirty) {
    command.sadd(POD_DIRTY_SET_REDIS_KEY, podId);
  }

  await command.exec();
}

async function clearDirtyPodState(podId: string) {
  const redis = getRedisClient();
  await redis.srem(POD_DIRTY_SET_REDIS_KEY, podId);
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

function clearActivePodTicker() {
  if (!activePodTicker) {
    return;
  }

  clearTimeout(activePodTicker);
  activePodTicker = null;
}

function scheduleActivePodTick() {
  if (!isPodStateTickerLeader || activePodTicker || !isPodStateTickerInitialized) {
    return;
  }

  const delayMs = Math.max(25, 1_000 - (Date.now() % 1_000));
  activePodTicker = setTimeout(() => {
    activePodTicker = null;
    void tickActivePods();
  }, delayMs);
  activePodTicker.unref?.();
}

async function tryAcquirePodTickerLeadership() {
  const redis = getRedisClient();
  const result = await redis.set(
    POD_TICKER_LEADER_LOCK_REDIS_KEY,
    POD_TICKER_INSTANCE_ID,
    "EX",
    POD_TICKER_LEADER_LOCK_TTL_SECONDS,
    "NX"
  );

  return result === "OK";
}

async function renewPodTickerLeadership() {
  const redis = getRedisClient();
  const result = await redis.eval(
    RENEW_LEADER_LOCK_LUA,
    1,
    POD_TICKER_LEADER_LOCK_REDIS_KEY,
    POD_TICKER_INSTANCE_ID,
    `${POD_TICKER_LEADER_LOCK_TTL_SECONDS}`
  );

  return Number(result) === 1;
}

async function releasePodTickerLeadership() {
  const redis = getRedisClient();
  await redis.eval(
    RELEASE_LEADER_LOCK_LUA,
    1,
    POD_TICKER_LEADER_LOCK_REDIS_KEY,
    POD_TICKER_INSTANCE_ID
  );
}

async function refreshPodTickerLeadership() {
  if (isRenewingTickerLeader) {
    return isPodStateTickerLeader;
  }

  isRenewingTickerLeader = true;

  try {
    if (isPodStateTickerLeader) {
      const renewed = await renewPodTickerLeadership();

      if (renewed) {
        scheduleActivePodTick();
        return true;
      }

      isPodStateTickerLeader = false;
      clearActivePodTicker();
      logger.warn("ommpods pod-state ticker leadership lost", {
        instanceId: POD_TICKER_INSTANCE_ID,
      });
    }

    const acquired = await tryAcquirePodTickerLeadership();
    if (!acquired) {
      return false;
    }

    isPodStateTickerLeader = true;
    logger.info("ommpods pod-state ticker leadership acquired", {
      instanceId: POD_TICKER_INSTANCE_ID,
    });
    scheduleActivePodTick();
    return true;
  } catch (error) {
    logger.warn("failed to refresh pod-state ticker leadership", {
      instanceId: POD_TICKER_INSTANCE_ID,
      error,
    });
    return false;
  } finally {
    isRenewingTickerLeader = false;
  }
}

async function listTickingPodIds() {
  const redis = getRedisClient();
  const [activePodIds, dirtyPodIds] = await Promise.all([
    redis.smembers(POD_ACTIVE_SET_REDIS_KEY),
    redis.smembers(POD_DIRTY_SET_REDIS_KEY),
  ]);

  return [...new Set([...activePodIds, ...dirtyPodIds].filter(Boolean))].sort();
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

async function tickActivePods() {
  if (isTickingActivePods || !isPodStateTickerLeader) {
    return;
  }

  isTickingActivePods = true;

  try {
    if (!(await refreshPodTickerLeadership())) {
      return;
    }

    for (const podId of await listTickingPodIds()) {
      if (!(await refreshPodTickerLeadership())) {
        return;
      }

      const cachedData = await readPodStateFromRedis(podId, {
        notifyListeners: false,
        syncRedisState: false,
      });

      if (cachedData) {
        await syncRedisPodActivity(podId, cachedData, false).catch((error) => {
          logger.warn("failed to sync pod activity during ticker read", {
            podId,
            error,
          });
        });

        notifyPodStateUpdated(podId, cachedData);
        await clearDirtyPodState(podId).catch((error) => {
          logger.warn("failed to clear dirty pod state", {
            podId,
            error,
          });
        });
        continue;
      }

      await refreshPodStateForPod(podId, {
        markDirty: false,
        notifyListeners: true,
      });
      await clearDirtyPodState(podId).catch((error) => {
        logger.warn("failed to clear dirty pod state after refresh", {
          podId,
          error,
        });
      });
    }
  } finally {
    isTickingActivePods = false;

    if (isPodStateTickerLeader) {
      scheduleActivePodTick();
    }
  }
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

export async function readPodStateFromRedis(
  podId: string,
  options: ReadPodStateOptions = {}
): Promise<PodState | null> {
  try {
    const redis = getRedisClient();
    const state = parseCachedPodState(await redis.get(getRedisKey(podId)), podId);

    if (!state) {
      return null;
    }

    const data = materializePodState(state);

    if (options.syncRedisState) {
      await syncRedisPodActivity(podId, data, false);
    }

    if (options.notifyListeners) {
      notifyPodStateUpdated(podId, data);
    }

    return data;
  } catch (error) {
    logger.warn("failed to read pod state from redis", {
      podId,
      error,
    });
    return null;
  }
}

export async function refreshPodStateForPod(
  podId: string,
  options: RefreshPodStateOptions = {}
): Promise<PodState> {
  const markDirty = options.markDirty ?? true;
  const notifyListeners = options.notifyListeners ?? true;
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
    await syncRedisPodActivity(podId, data, markDirty).catch((error) => {
      logger.warn("failed to sync idle pod redis activity", {
        podId,
        error,
      });
    });

    if (notifyListeners) {
      notifyPodStateUpdated(podId, data);
    }

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
    await syncRedisPodActivity(podId, data, markDirty).catch((error) => {
      logger.warn("failed to sync pod redis activity without session", {
        podId,
        error,
      });
    });

    if (notifyListeners) {
      notifyPodStateUpdated(podId, data);
    }

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
  await syncRedisPodActivity(podId, data, markDirty).catch((error) => {
    logger.warn("failed to sync active pod redis activity", {
      podId,
      error,
    });
  });

  if (notifyListeners) {
    notifyPodStateUpdated(podId, data);
  }

  return data;
}

export function hasPodStateTickerLeadership() {
  return isPodStateTickerLeader;
}

export async function initializePodStateTicker() {
  if (isPodStateTickerInitialized) {
    return;
  }

  isPodStateTickerInitialized = true;

  const sessionEndWindowStart = new Date(Date.now() - getSessionStartEndDelaySeconds() * 1000);
  const sessions = await db
    .select({
      podId: podSessions.podId,
    })
    .from(podSessions)
    .where(
      and(
        inArray(podSessions.status, ["CONFIRMED", "CANCELLED", "EMERGENCY_UNLOCKED"]),
        eq(podSessions.isDeleted, false),
        gt(podSessions.endAt, sessionEndWindowStart)
      )
    );

  const podIds = [...new Set(sessions.map((session) => session.podId).filter(Boolean))];
  await Promise.allSettled(podIds.map((podId) => refreshPodStateForPod(podId)));
  await refreshPodTickerLeadership();

  tickerLeaderRenewTimer = setInterval(() => {
    void refreshPodTickerLeadership();
  }, POD_TICKER_LEADER_RENEW_INTERVAL_MS);
  tickerLeaderRenewTimer.unref?.();

  scheduleActivePodTick();
}

export async function closePodStateTicker() {
  isPodStateTickerInitialized = false;
  clearActivePodTicker();

  if (tickerLeaderRenewTimer) {
    clearInterval(tickerLeaderRenewTimer);
    tickerLeaderRenewTimer = null;
  }

  if (isPodStateTickerLeader) {
    isPodStateTickerLeader = false;
    await releasePodTickerLeadership().catch((error) => {
      logger.warn("failed to release pod-state ticker leadership", {
        instanceId: POD_TICKER_INSTANCE_ID,
        error,
      });
    });
  }
}
