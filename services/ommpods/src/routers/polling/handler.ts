import type { AppBindings } from "@/types/app";
import { logger } from "@/lib/logger";
import { OpenAPIHono } from "@hono/zod-openapi";
import {
  createApiSuccessResponse,
  createOpenApiRoute,
  createSuccessResponse,
  IdStringParamSchema,
  registerOpenApiRoute,
} from "@ikyomm/utils";
import { buildSafePollingData, readPollingDataFromRedis, refreshPollingDataForPod } from "./state";
import { pollingResponseSchema, type PollingResponse } from "./schema";

export const pollingGroup = new OpenAPIHono<AppBindings>();

type PollingDataSource = "redis" | "live" | "memory" | "stale" | "safe-default";

type PollingCacheEntry = {
  data?: PollingResponse;
  updatedAt: number;
  inFlight?: Promise<PollingReadResult>;
  inFlightStartedAt?: number;
};

type PollingReadResult = {
  data: PollingResponse;
  source: PollingDataSource;
};

const POLLING_RESPONSE_TIMEOUT_MS = 800;
const POLLING_MEMORY_CACHE_MAX_AGE_MS = 1_500;
const POLLING_STALE_MAX_AGE_MS = 10_000;
const POLLING_CACHE_MAX_ENTRIES = 1_000;
const pollingCache = new Map<string, PollingCacheEntry>();

function getPollingFallback(podId: string): PollingReadResult {
  const cached = pollingCache.get(podId);
  const now = Date.now();

  if (cached?.data && now - cached.updatedAt <= POLLING_STALE_MAX_AGE_MS) {
    return {
      data: cached.data,
      source: "stale",
    };
  }

  return {
    data: buildSafePollingData(),
    source: "safe-default",
  };
}

function setPollingCacheData(podId: string, data: PollingResponse) {
  if (!pollingCache.has(podId) && pollingCache.size >= POLLING_CACHE_MAX_ENTRIES) {
    const oldestKey = pollingCache.keys().next().value;
    if (oldestKey) {
      pollingCache.delete(oldestKey);
    }
  }

  pollingCache.set(podId, {
    ...(pollingCache.get(podId) ?? {}),
    data,
    updatedAt: Date.now(),
  });
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T | null> {
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<null>((resolve) => {
        timeout = setTimeout(() => resolve(null), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

function startPollingFetch(podId: string): Promise<PollingReadResult> {
  const existing = pollingCache.get(podId);

  if (existing?.inFlight) {
    return existing.inFlight;
  }

  let inFlight: Promise<PollingReadResult>;

  inFlight = refreshPollingDataForPod(podId)
    .then((data) => {
      setPollingCacheData(podId, data);
      return {
        data,
        source: "live" as const,
      };
    })
    .catch((error) => {
      logger.warn("polling fetch failed; serving fallback", {
        podId,
        error,
      });
      return getPollingFallback(podId);
    })
    .finally(() => {
      const current = pollingCache.get(podId);
      if (current?.inFlight === inFlight) {
        pollingCache.set(podId, {
          ...current,
          inFlight: undefined,
          inFlightStartedAt: undefined,
        });
      }
    });

  pollingCache.set(podId, {
    ...(existing ?? { updatedAt: 0 }),
    inFlight,
    inFlightStartedAt: Date.now(),
  });

  return inFlight;
}

async function readPollingData(podId: string): Promise<PollingReadResult> {
  const existing = pollingCache.get(podId);
  const now = Date.now();

  if (existing?.data && now - existing.updatedAt <= POLLING_MEMORY_CACHE_MAX_AGE_MS) {
    return {
      data: existing.data,
      source: "memory",
    };
  }

  const redisData = await readPollingDataFromRedis(podId);
  if (redisData) {
    setPollingCacheData(podId, redisData);
    return {
      data: redisData,
      source: "redis",
    };
  }

  if (existing?.inFlight && existing.data) {
    return getPollingFallback(podId);
  }

  const result = await withTimeout(startPollingFetch(podId), POLLING_RESPONSE_TIMEOUT_MS);
  if (result) {
    return result;
  }

  logger.warn("polling fetch timed out; serving fallback", {
    podId,
    timeoutMs: POLLING_RESPONSE_TIMEOUT_MS,
  });

  return getPollingFallback(podId);
}

const route = createOpenApiRoute({
  method: "get",
  path: "/pods/{id}",
  operationId: "ommpodsPodPolling",
  tags: ["Polling"],
  summary: "Poll live Pod hardware data",
  request: {
    params: IdStringParamSchema(),
  },
  responses: {
    200: createApiSuccessResponse(pollingResponseSchema, "Pod polling data fetched successfully"),
  },
});

registerOpenApiRoute(pollingGroup, route, async (c) => {
  const { id: podId } = c.req.valid("param");
  const result = await readPollingData(podId);

  c.header("Cache-Control", "no-store, max-age=0");
  c.header("X-OMMPods-Polling-Source", result.source);

  return c.json(createSuccessResponse(result.data), 200);
});
