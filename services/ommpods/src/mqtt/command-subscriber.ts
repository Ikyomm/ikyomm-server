import crypto from "node:crypto";
import { z } from "zod";
import { env } from "@/config/env";
import { logger } from "@/lib/logger";
import { hasPodStateTickerLeadership, refreshPodStateForPod } from "@/pod-state";
import { db, musics, podSessions } from "@ikyomm/database";
import { and, eq, gt, inArray, sql } from "drizzle-orm";
import { getOmmpodsMqtt } from "./index";
import {
  appendSessionControlLog,
  findActiveMoodPreset,
  getAromaValidationError,
} from "@/routers/control/utils";
import { getSessionStartEndDelaySeconds, hydratePodAromaDefusers } from "@/routers/shared";

const POD_COMMAND_TOPIC = /^ommpod\/pods\/([^/]+)\/commands\/(mood|aroma|music|emergency-unlock)$/;
const SESSION_COMMAND_TOPIC =
  /^ommpod\/sessions\/([^/]+)\/commands\/(mood|aroma|emergency-unlock)$/;
const POD_COMMAND_SUBSCRIPTIONS = [
  "ommpod/pods/+/commands/mood",
  "ommpod/pods/+/commands/aroma",
  "ommpod/pods/+/commands/music",
  "ommpod/pods/+/commands/emergency-unlock",
] as const;
const SESSION_COMMAND_SUBSCRIPTIONS = [
  "ommpod/sessions/+/commands/mood",
  "ommpod/sessions/+/commands/aroma",
  "ommpod/sessions/+/commands/emergency-unlock",
] as const;

const requestMetaSchema = z
  .object({
    requestId: z.string().trim().min(1).optional(),
  })
  .passthrough();

const moodCommandSchema = requestMetaSchema.extend({
  moodPresetId: z.string().trim().min(1),
});

const aromaCommandSchema = requestMetaSchema.extend({
  aromaDefuserId: z.string().trim().min(1).nullable().optional(),
  activeDufuserContainerNumber: z.coerce.number().int().positive().nullable(),
});

const musicCommandSchema = requestMetaSchema.extend({
  playlistId: z.string().trim().min(1).nullable().optional(),
  musicId: z.string().trim().min(1).nullable().optional(),
  playbackState: z.enum(["playing", "paused"]).default("playing"),
  positionSeconds: z.coerce.number().min(0).default(0),
  volume: z.coerce.number().min(0).max(1).default(1),
  outputSource: z.enum(["speaker", "bluetooth"]).default("speaker"),
  nonce: z.string().trim().optional(),
});

type SupportedCommand = "mood" | "aroma" | "music" | "emergency-unlock";

let isMqttCommandSubscriberInitialized = false;

function getSessionAromaDefusers(session: unknown) {
  const pod = (session as { pod?: { aromaDefusers?: unknown } | null } | null | undefined)?.pod;
  return (pod?.aromaDefusers ?? []) as Parameters<
    typeof getAromaValidationError
  >[0]["aromaDefusers"];
}

function getPodCommandResultTopic(podId: string) {
  return `ommpod/pods/${podId}/command/result`;
}

function getSessionCommandResultTopic(sessionId: string) {
  return `ommpod/sessions/${sessionId}/command/result`;
}

async function publishCommandResult(
  topic: string,
  payload: Record<string, unknown>,
  podId?: string,
  sessionId?: string
) {
  const connection = getOmmpodsMqtt();
  if (!connection?.connected) {
    return;
  }

  await connection.publish(topic, JSON.stringify(payload), {
    qos: env.MQTT_QOS as 0 | 1 | 2,
    retain: false,
  });

  logger.info("ommpods mqtt command result published", {
    topic,
    podId,
    sessionId,
  });
}

async function publishSuccessResult(input: {
  topic: string;
  command: SupportedCommand;
  podId: string;
  sessionId: string | null;
  requestId?: string;
  message?: string;
}) {
  await publishCommandResult(
    input.topic,
    {
      success: true,
      command: input.command,
      podId: input.podId,
      sessionId: input.sessionId,
      requestId: input.requestId ?? null,
      message: input.message ?? "Command processed",
      at: new Date().toISOString(),
    },
    input.podId,
    input.sessionId ?? undefined
  );
}

async function publishErrorResult(input: {
  topic: string;
  command: SupportedCommand;
  podId?: string | null;
  sessionId?: string | null;
  requestId?: string;
  code: string;
  message: string;
}) {
  await publishCommandResult(
    input.topic,
    {
      success: false,
      command: input.command,
      podId: input.podId ?? null,
      sessionId: input.sessionId ?? null,
      requestId: input.requestId ?? null,
      error: {
        code: input.code,
        message: input.message,
      },
      at: new Date().toISOString(),
    },
    input.podId ?? undefined,
    input.sessionId ?? undefined
  );
}

async function findActiveSessionByPodId(podId: string) {
  const now = new Date();
  const session = await db.query.podSessions.findFirst({
    where: and(
      eq(podSessions.podId, podId),
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

  if (!session?.pod) {
    return session;
  }

  return {
    ...session,
    pod: await hydratePodAromaDefusers(session.pod),
  };
}

async function findActiveSessionById(sessionId: string) {
  const now = new Date();
  const session = await db.query.podSessions.findFirst({
    where: and(
      eq(podSessions.id, sessionId),
      eq(podSessions.status, "CONFIRMED"),
      eq(podSessions.isDeleted, false),
      gt(podSessions.endAt, now)
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

async function handleSessionMoodCommand(sessionId: string, rawPayload: Buffer) {
  const payload = moodCommandSchema.safeParse(JSON.parse(rawPayload.toString("utf8")));
  const resultTopic = getSessionCommandResultTopic(sessionId);

  if (!payload.success) {
    await publishErrorResult({
      topic: resultTopic,
      command: "mood",
      sessionId,
      code: "INVALID_PAYLOAD",
      message: payload.error.issues[0]?.message ?? "Mood command payload is invalid",
    });
    return;
  }

  const session = await findActiveSessionById(sessionId);
  if (!session?.pod) {
    await publishErrorResult({
      topic: resultTopic,
      command: "mood",
      sessionId,
      requestId: payload.data.requestId,
      code: "SESSION_NOT_FOUND",
      message: "Active session not found",
    });
    return;
  }

  const moodPreset = await findActiveMoodPreset(payload.data.moodPresetId);
  if (!moodPreset) {
    await publishErrorResult({
      topic: resultTopic,
      command: "mood",
      podId: session.podId,
      sessionId,
      requestId: payload.data.requestId,
      code: "MOOD_NOT_FOUND",
      message: "Mood preset not found",
    });
    return;
  }

  if (session.pod.type && !moodPreset.enabledPodTypes.includes(session.pod.type)) {
    await publishErrorResult({
      topic: resultTopic,
      command: "mood",
      podId: session.podId,
      sessionId,
      requestId: payload.data.requestId,
      code: "MOOD_NOT_ALLOWED",
      message: "Mood preset is not enabled for this pod type",
    });
    return;
  }

  await appendSessionControlLog({
    sessionId,
    eventType: "MOOD_CHANGED",
    payload: {
      moodPresetId: moodPreset.id,
    },
  });
  await refreshPodStateForPod(session.podId);

  await publishSuccessResult({
    topic: resultTopic,
    command: "mood",
    podId: session.podId,
    sessionId,
    requestId: payload.data.requestId,
  });
}

async function handleSessionAromaCommand(sessionId: string, rawPayload: Buffer) {
  const payload = aromaCommandSchema.safeParse(JSON.parse(rawPayload.toString("utf8")));
  const resultTopic = getSessionCommandResultTopic(sessionId);

  if (!payload.success) {
    await publishErrorResult({
      topic: resultTopic,
      command: "aroma",
      sessionId,
      code: "INVALID_PAYLOAD",
      message: payload.error.issues[0]?.message ?? "Aroma command payload is invalid",
    });
    return;
  }

  const session = await findActiveSessionById(sessionId);
  if (!session?.pod) {
    await publishErrorResult({
      topic: resultTopic,
      command: "aroma",
      sessionId,
      requestId: payload.data.requestId,
      code: "SESSION_NOT_FOUND",
      message: "Active session not found",
    });
    return;
  }

  const aromaDefusers = getSessionAromaDefusers(session);
  const activeAromaDefuserId =
    payload.data.activeDufuserContainerNumber === null
      ? null
      : (payload.data.aromaDefuserId ?? aromaDefusers[0]?.id ?? null);
  const validationError = getAromaValidationError({
    aromaDefusers,
    aromaDefuserId: activeAromaDefuserId,
    containerNumber: payload.data.activeDufuserContainerNumber,
  });

  if (validationError) {
    await publishErrorResult({
      topic: resultTopic,
      command: "aroma",
      podId: session.podId,
      sessionId,
      requestId: payload.data.requestId,
      code: "INVALID_AROMA",
      message: validationError,
    });
    return;
  }

  await appendSessionControlLog({
    sessionId,
    eventType: "AROMA_CHANGED",
    payload: {
      activeAromaDefuserId,
      activeDufuserContainerNumber: payload.data.activeDufuserContainerNumber,
    },
  });
  await refreshPodStateForPod(session.podId);

  await publishSuccessResult({
    topic: resultTopic,
    command: "aroma",
    podId: session.podId,
    sessionId,
    requestId: payload.data.requestId,
  });
}

async function handleSessionEmergencyUnlockCommand(sessionId: string, rawPayload: Buffer) {
  const payload = requestMetaSchema.safeParse(JSON.parse(rawPayload.toString("utf8") || "{}"));
  const resultTopic = getSessionCommandResultTopic(sessionId);

  if (!payload.success) {
    await publishErrorResult({
      topic: resultTopic,
      command: "emergency-unlock",
      sessionId,
      code: "INVALID_PAYLOAD",
      message: "Emergency unlock payload is invalid",
    });
    return;
  }

  const session = await findActiveSessionById(sessionId);
  if (!session?.pod) {
    await publishErrorResult({
      topic: resultTopic,
      command: "emergency-unlock",
      sessionId,
      requestId: payload.data.requestId,
      code: "SESSION_NOT_FOUND",
      message: "Active session not found",
    });
    return;
  }

  const now = new Date();
  await db
    .update(podSessions)
    .set({
      status: "EMERGENCY_UNLOCKED",
      endAt: now,
    })
    .where(eq(podSessions.id, sessionId));
  await refreshPodStateForPod(session.podId);

  await publishSuccessResult({
    topic: resultTopic,
    command: "emergency-unlock",
    podId: session.podId,
    sessionId,
    requestId: payload.data.requestId,
    message: "Emergency unlock completed",
  });
}

async function handlePodMoodCommand(podId: string, rawPayload: Buffer) {
  const payload = moodCommandSchema.safeParse(JSON.parse(rawPayload.toString("utf8")));
  const resultTopic = getPodCommandResultTopic(podId);

  if (!payload.success) {
    await publishErrorResult({
      topic: resultTopic,
      command: "mood",
      podId,
      code: "INVALID_PAYLOAD",
      message: payload.error.issues[0]?.message ?? "Mood command payload is invalid",
    });
    return;
  }

  const session = await findActiveSessionByPodId(podId);
  if (!session?.pod) {
    await publishErrorResult({
      topic: resultTopic,
      command: "mood",
      podId,
      requestId: payload.data.requestId,
      code: "SESSION_NOT_FOUND",
      message: "Active session not found",
    });
    return;
  }

  const moodPreset = await findActiveMoodPreset(payload.data.moodPresetId);
  if (!moodPreset) {
    await publishErrorResult({
      topic: resultTopic,
      command: "mood",
      podId,
      sessionId: session.id,
      requestId: payload.data.requestId,
      code: "MOOD_NOT_FOUND",
      message: "Mood preset not found",
    });
    return;
  }

  if (session.pod.type && !moodPreset.enabledPodTypes.includes(session.pod.type)) {
    await publishErrorResult({
      topic: resultTopic,
      command: "mood",
      podId,
      sessionId: session.id,
      requestId: payload.data.requestId,
      code: "MOOD_NOT_ALLOWED",
      message: "Mood preset is not enabled for this pod type",
    });
    return;
  }

  await appendSessionControlLog({
    sessionId: session.id,
    eventType: "MOOD_CHANGED",
    payload: {
      moodPresetId: moodPreset.id,
    },
  });
  await refreshPodStateForPod(podId);

  await publishSuccessResult({
    topic: resultTopic,
    command: "mood",
    podId,
    sessionId: session.id,
    requestId: payload.data.requestId,
  });
}

async function handlePodAromaCommand(podId: string, rawPayload: Buffer) {
  const payload = aromaCommandSchema.safeParse(JSON.parse(rawPayload.toString("utf8")));
  const resultTopic = getPodCommandResultTopic(podId);

  if (!payload.success) {
    await publishErrorResult({
      topic: resultTopic,
      command: "aroma",
      podId,
      code: "INVALID_PAYLOAD",
      message: payload.error.issues[0]?.message ?? "Aroma command payload is invalid",
    });
    return;
  }

  const session = await findActiveSessionByPodId(podId);
  if (!session?.pod) {
    await publishErrorResult({
      topic: resultTopic,
      command: "aroma",
      podId,
      requestId: payload.data.requestId,
      code: "SESSION_NOT_FOUND",
      message: "Active session not found",
    });
    return;
  }

  const aromaDefusers = getSessionAromaDefusers(session);
  const activeAromaDefuserId =
    payload.data.activeDufuserContainerNumber === null
      ? null
      : (payload.data.aromaDefuserId ?? aromaDefusers[0]?.id ?? null);
  const validationError = getAromaValidationError({
    aromaDefusers,
    aromaDefuserId: activeAromaDefuserId,
    containerNumber: payload.data.activeDufuserContainerNumber,
  });

  if (validationError) {
    await publishErrorResult({
      topic: resultTopic,
      command: "aroma",
      podId,
      sessionId: session.id,
      requestId: payload.data.requestId,
      code: "INVALID_AROMA",
      message: validationError,
    });
    return;
  }

  await appendSessionControlLog({
    sessionId: session.id,
    eventType: "AROMA_CHANGED",
    payload: {
      activeAromaDefuserId,
      activeDufuserContainerNumber: payload.data.activeDufuserContainerNumber,
    },
  });
  await refreshPodStateForPod(podId);

  await publishSuccessResult({
    topic: resultTopic,
    command: "aroma",
    podId,
    sessionId: session.id,
    requestId: payload.data.requestId,
  });
}

async function handlePodMusicCommand(podId: string, rawPayload: Buffer) {
  const payload = musicCommandSchema.safeParse(JSON.parse(rawPayload.toString("utf8")));
  const resultTopic = getPodCommandResultTopic(podId);

  if (!payload.success) {
    await publishErrorResult({
      topic: resultTopic,
      command: "music",
      podId,
      code: "INVALID_PAYLOAD",
      message: payload.error.issues[0]?.message ?? "Music command payload is invalid",
    });
    return;
  }

  const session = await findActiveSessionByPodId(podId);
  if (!session) {
    await publishErrorResult({
      topic: resultTopic,
      command: "music",
      podId,
      requestId: payload.data.requestId,
      code: "SESSION_NOT_FOUND",
      message: "Active session not found",
    });
    return;
  }

  if (payload.data.musicId && payload.data.playlistId) {
    const music = await db.query.musics.findFirst({
      where: and(
        eq(musics.id, payload.data.musicId),
        eq(musics.playlistId, payload.data.playlistId),
        eq(musics.isDeleted, false)
      ),
    });

    if (!music) {
      await publishErrorResult({
        topic: resultTopic,
        command: "music",
        podId,
        sessionId: session.id,
        requestId: payload.data.requestId,
        code: "INVALID_MUSIC",
        message: "Music is not available for the selected playlist",
      });
      return;
    }
  }

  await appendSessionControlLog({
    sessionId: session.id,
    eventType: "MUSIC_CHANGED",
    payload: {
      playlistId: payload.data.playlistId ?? null,
      musicId: payload.data.musicId ?? null,
      playbackState: payload.data.playbackState,
      positionSeconds: payload.data.positionSeconds,
      volume: payload.data.volume,
      outputSource: payload.data.outputSource,
      updatedAt: new Date().toISOString(),
      nonce: payload.data.nonce ?? crypto.randomUUID(),
    },
  });
  await refreshPodStateForPod(podId);

  await publishSuccessResult({
    topic: resultTopic,
    command: "music",
    podId,
    sessionId: session.id,
    requestId: payload.data.requestId,
  });
}

async function handlePodEmergencyUnlockCommand(podId: string, rawPayload: Buffer) {
  const payload = requestMetaSchema.safeParse(JSON.parse(rawPayload.toString("utf8") || "{}"));
  const resultTopic = getPodCommandResultTopic(podId);

  if (!payload.success) {
    await publishErrorResult({
      topic: resultTopic,
      command: "emergency-unlock",
      podId,
      code: "INVALID_PAYLOAD",
      message: "Emergency unlock payload is invalid",
    });
    return;
  }

  const now = new Date();
  const unlockWindowSeconds = Math.max(getSessionStartEndDelaySeconds(), 5);
  const sessionEndWindowStart = new Date(now.getTime() - unlockWindowSeconds * 1000);
  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${podId}))`);

    const session = await tx.query.podSessions.findFirst({
      where: and(
        eq(podSessions.podId, podId),
        inArray(podSessions.status, ["CONFIRMED", "CANCELLED", "EMERGENCY_UNLOCKED"]),
        eq(podSessions.isDeleted, false),
        gt(podSessions.endAt, sessionEndWindowStart)
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

    if (!session) {
      return null;
    }

    if (session.status !== "CONFIRMED" || session.endAt.getTime() <= now.getTime()) {
      return {
        session,
        location: session.pod?.location,
      };
    }

    const [endedSession] = await tx
      .update(podSessions)
      .set({
        status: "EMERGENCY_UNLOCKED",
        endAt: now,
      })
      .where(eq(podSessions.id, session.id))
      .returning();

    return {
      session: endedSession ?? session,
      location: session.pod?.location,
    };
  });

  if (!result) {
    await publishErrorResult({
      topic: resultTopic,
      command: "emergency-unlock",
      podId,
      requestId: payload.data.requestId,
      code: "SESSION_NOT_FOUND",
      message: "Active session not found",
    });
    return;
  }

  await refreshPodStateForPod(podId);

  await publishSuccessResult({
    topic: resultTopic,
    command: "emergency-unlock",
    podId,
    sessionId: result.session.id,
    requestId: payload.data.requestId,
    message: "Emergency unlock completed",
  });
}

async function handleCommandMessage(topic: string, payload: Buffer) {
  if (!hasPodStateTickerLeadership()) {
    return;
  }

  const podMatch = topic.match(POD_COMMAND_TOPIC);
  if (podMatch) {
    const [, podId, command] = podMatch as [string, string, SupportedCommand];

    switch (command) {
      case "mood":
        await handlePodMoodCommand(podId, payload);
        return;
      case "aroma":
        await handlePodAromaCommand(podId, payload);
        return;
      case "music":
        await handlePodMusicCommand(podId, payload);
        return;
      case "emergency-unlock":
        await handlePodEmergencyUnlockCommand(podId, payload);
        return;
    }
  }

  const sessionMatch = topic.match(SESSION_COMMAND_TOPIC);
  if (sessionMatch) {
    const [, sessionId, command] = sessionMatch as [string, string, SupportedCommand];

    switch (command) {
      case "mood":
        await handleSessionMoodCommand(sessionId, payload);
        return;
      case "aroma":
        await handleSessionAromaCommand(sessionId, payload);
        return;
      case "emergency-unlock":
        await handleSessionEmergencyUnlockCommand(sessionId, payload);
        return;
      default:
        return;
    }
  }
}

export function initializeOmmpodsMqttCommandSubscriber() {
  if (isMqttCommandSubscriberInitialized) {
    return;
  }

  isMqttCommandSubscriberInitialized = true;
  const connection = getOmmpodsMqtt();

  connection?.onConnect(async () => {
    await connection.subscribe([...POD_COMMAND_SUBSCRIPTIONS, ...SESSION_COMMAND_SUBSCRIPTIONS], {
      qos: env.MQTT_QOS as 0 | 1 | 2,
    });

    logger.info("ommpods mqtt command topics subscribed", {
      podTopics: POD_COMMAND_SUBSCRIPTIONS,
      sessionTopics: SESSION_COMMAND_SUBSCRIPTIONS,
    });
  });

  connection?.onMessage((topic, payload) => handleCommandMessage(topic, payload));
}
