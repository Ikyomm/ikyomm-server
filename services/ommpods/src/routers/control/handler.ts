import type { AppBindings } from "@/types/app";
import { createOpenApiHono } from "@/lib/openapi-hono";
import { db, podSessions } from "@ikyomm/database";
import {
  createErrorResponse,
  createSuccessResponse,
  getBetterAuthContext,
  registerOpenApiRoute,
} from "@ikyomm/utils";
import { eq } from "drizzle-orm";
import type { Context } from "hono";
import { refreshPodStateForPod } from "@/pod-state";
import { buildSessionResponse, findActiveSessionForUser } from "../shared";
import { updateAromaRoute, updateMoodRoute } from "./openapi.route";
import {
  appendSessionControlLog,
  controlAuthMiddleware,
  findActiveMoodPreset,
  getAromaValidationError,
} from "./utils";

export const controlGroup = createOpenApiHono<AppBindings>();

controlGroup.use("*", controlAuthMiddleware);

registerOpenApiRoute(controlGroup, updateMoodRoute, async (c) => {
  const { sessionId } = c.req.valid("param");
  const body = c.req.valid("json");
  const { user: currentUser } = getBetterAuthContext(c);

  if (!currentUser) {
    return c.json(
      createErrorResponse({ error: "Unauthorized", message: "Active session not found" }),
      401
    );
  }

  const session = await findActiveSessionForUser(sessionId, currentUser.id);
  if (!session) {
    return c.json(
      createErrorResponse({ error: "Not Found", message: "Active session not found" }),
      404
    );
  }

  const moodPreset = await findActiveMoodPreset(body.moodPresetId);
  if (!moodPreset) {
    return c.json(
      createErrorResponse({ error: "Not Found", message: "Mood preset not found" }),
      404
    );
  }

  if (session.pod?.type && !moodPreset.enabledPodTypes.includes(session.pod.type)) {
    return c.json(
      createErrorResponse({
        error: "Bad Request",
        message: "Mood preset is not enabled for this pod type",
      }),
      400
    );
  }

  await appendSessionControlLog({
    sessionId,
    eventType: "MOOD_CHANGED",
    payload: {
      moodPresetId: moodPreset.id,
    },
    createdByUser: currentUser.id,
  });
  await refreshPodStateForPod(session.podId);

  return c.json(
    createSuccessResponse({
      ...buildSessionResponse(session, new Date(), session.pod?.location),
      rgb: moodPreset.rgb,
      moodPresetId: moodPreset.id,
    }),
    200
  );
});

controlGroup.post("/emergency-unlock/sessions/:sessionId", async (c: Context<AppBindings>) => {
  const sessionId = c.req.param("sessionId");
  const { user: currentUser } = getBetterAuthContext(c);

  if (!currentUser) {
    return c.json(
      createErrorResponse({ error: "Unauthorized", message: "Active session not found" }),
      401
    );
  }

  const session = await findActiveSessionForUser(sessionId, currentUser.id);
  if (!session) {
    return c.json(
      createErrorResponse({ error: "Not Found", message: "Active session not found" }),
      404
    );
  }

  const now = new Date();
  const [endedSession] = await db
    .update(podSessions)
    .set({
      status: "EMERGENCY_UNLOCKED",
      endAt: now,
      updatedByUser: currentUser.id,
    })
    .where(eq(podSessions.id, sessionId))
    .returning();
  await refreshPodStateForPod(session.podId);

  return c.json(
    createSuccessResponse({
      message: "Emergency unlock completed",
      session: buildSessionResponse(endedSession ?? session, now, session.pod?.location),
    }),
    200
  );
});

registerOpenApiRoute(controlGroup, updateAromaRoute, async (c) => {
  const { sessionId } = c.req.valid("param");
  const body = c.req.valid("json");
  const { user: currentUser } = getBetterAuthContext(c);

  if (!currentUser) {
    return c.json(
      createErrorResponse({ error: "Unauthorized", message: "Active session not found" }),
      401
    );
  }

  const session = await findActiveSessionForUser(sessionId, currentUser.id);
  if (!session) {
    return c.json(
      createErrorResponse({ error: "Not Found", message: "Active session not found" }),
      404
    );
  }

  const aromaDefusers =
    (
      session.pod as {
        aromaDefusers?: Parameters<typeof getAromaValidationError>[0]["aromaDefusers"];
      }
    )?.aromaDefusers ?? [];
  const activeAromaDefuserId =
    body.activeDufuserContainerNumber === null
      ? null
      : (body.aromaDefuserId ?? aromaDefusers[0]?.id ?? null);

  const validationError = getAromaValidationError({
    aromaDefusers,
    aromaDefuserId: activeAromaDefuserId,
    containerNumber: body.activeDufuserContainerNumber,
  });
  if (validationError) {
    return c.json(createErrorResponse({ error: "Bad Request", message: validationError }), 400);
  }

  await appendSessionControlLog({
    sessionId,
    eventType: "AROMA_CHANGED",
    payload: {
      activeAromaDefuserId,
      activeDufuserContainerNumber: body.activeDufuserContainerNumber,
    },
    createdByUser: currentUser.id,
  });
  await refreshPodStateForPod(session.podId);

  return c.json(
    createSuccessResponse({
      ...buildSessionResponse(session, new Date(), session.pod?.location),
      activeAromaDefuserId,
      activeDufuserContainerNumber: body.activeDufuserContainerNumber,
    }),
    200
  );
});
