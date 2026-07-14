import type { AppBindings } from "@/types/app";
import { createOpenApiHono } from "@/lib/openapi-hono";
import { readPodStateFromRedis, refreshPodStateForPod } from "@/pod-state";
import type { Context } from "hono";
import { db, musicPlaylists, musics, podMoodPresets, podSessions } from "@ikyomm/database";
import { createErrorResponse, createSuccessResponse } from "@ikyomm/utils";
import { and, eq, gt, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import {
  appendSessionControlLog,
  findActiveMoodPreset,
  getAromaValidationError,
} from "../control/utils";
import {
  DEFAULT_MUSIC_VOLUME,
  buildSessionResponse,
  findPodWithAromaDefuser,
  getSessionStartEndDelaySeconds,
  hydratePodAromaDefusers,
} from "../shared";

export const tabletGroup = createOpenApiHono<AppBindings>();

const moodBodySchema = z.object({
  moodPresetId: z.string().trim().min(1),
});

const aromaBodySchema = z.object({
  aromaDefuserId: z.string().trim().min(1).nullable().optional(),
  activeDufuserContainerNumber: z.coerce.number().int().positive().nullable(),
});

const musicBodySchema = z.object({
  playlistId: z.string().trim().min(1).nullable().optional(),
  musicId: z.string().trim().min(1).nullable().optional(),
  playbackState: z.enum(["playing", "paused"]).default("playing"),
  positionSeconds: z.coerce.number().min(0).default(0),
  volume: z.coerce.number().min(0).max(1).default(DEFAULT_MUSIC_VOLUME),
  outputSource: z.enum(["speaker", "bluetooth"]).default("speaker"),
  nonce: z.string().trim().optional(),
});

type TabletAromaDefuser = {
  id: string;
  name?: string | null;
  macId: string;
  containers?: unknown[] | null;
};

type TabletPod = NonNullable<Awaited<ReturnType<typeof findPodWithAromaDefuser>>>;

function serializeTabletPod(pod: TabletPod) {
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
    aromaDefusers: (pod.aromaDefusers ?? []).map((aromaDefuser: TabletAromaDefuser) => ({
      id: aromaDefuser.id,
      name: aromaDefuser.name ?? null,
      macId: aromaDefuser.macId,
      containers: aromaDefuser.containers ?? [],
    })),
  };
}

async function findTabletPod(podId: string) {
  return findPodWithAromaDefuser(podId);
}

async function findTabletControlSession(podId: string) {
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

async function listMoodsForPod(pod: TabletPod) {
  return db.query.podMoodPresets.findMany({
    where: and(
      eq(podMoodPresets.isDeleted, false),
      pod.type ? sql`${pod.type}::ommpod_type = ANY(${podMoodPresets.enabledPodTypes})` : undefined
    ),
    orderBy: (table, { asc }) => [asc(table.title)],
  });
}

async function buildMusicLibrary(moodPresetId: string | null | undefined) {
  if (!moodPresetId) {
    return {
      playlists: [],
      musicsByPlaylistId: {},
    };
  }

  const moodPreset = await db.query.podMoodPresets.findFirst({
    where: and(eq(podMoodPresets.id, moodPresetId), eq(podMoodPresets.isDeleted, false)),
  });
  const playlistIds = moodPreset?.playlistIds ?? [];

  if (playlistIds.length === 0) {
    return {
      playlists: [],
      musicsByPlaylistId: {},
    };
  }

  const [playlists, musicItems] = await Promise.all([
    db.query.musicPlaylists.findMany({
      where: and(eq(musicPlaylists.isDeleted, false), inArray(musicPlaylists.id, playlistIds)),
      orderBy: (table, { asc }) => [asc(table.name)],
    }),
    db.query.musics.findMany({
      where: and(eq(musics.isDeleted, false), inArray(musics.playlistId, playlistIds)),
      orderBy: (table, { asc }) => [asc(table.name)],
    }),
  ]);

  return {
    playlists,
    musicsByPlaylistId: musicItems.reduce<Record<string, typeof musicItems>>((acc, music) => {
      acc[music.playlistId] = [...(acc[music.playlistId] ?? []), music];
      return acc;
    }, {}),
  };
}

async function buildTabletState(podId: string, preferredMoodPresetId?: string | null) {
  const pod = await findTabletPod(podId);

  if (!pod) {
    return null;
  }

  const [polling, moods] = await Promise.all([
    (await readPodStateFromRedis(pod.id)) ?? (await refreshPodStateForPod(pod.id)),
    listMoodsForPod(pod),
  ]);
  const selectedMoodId = preferredMoodPresetId ?? polling.moodPresetId ?? moods[0]?.id ?? null;
  const musicLibrary = await buildMusicLibrary(selectedMoodId);

  return {
    pod: serializeTabletPod(pod),
    session: polling.session,
    polling,
    moods,
    musicLibrary,
  };
}

function getBadRequest(c: Context<AppBindings>, message: string) {
  return c.json(createErrorResponse({ error: "Bad Request", message }), 400);
}

tabletGroup.get("/pods/:podId/state", async (c: Context<AppBindings>) => {
  const podId = c.req.param("podId");
  const state = await buildTabletState(podId);

  if (!state) {
    return c.json(createErrorResponse({ error: "Not Found", message: "Pod not found" }), 404);
  }

  return c.json(createSuccessResponse(state), 200);
});

tabletGroup.post("/pods/:podId/mood", async (c: Context<AppBindings>) => {
  const podId = c.req.param("podId");
  const body = moodBodySchema.safeParse(await c.req.json().catch(() => null));

  if (!body.success) {
    return getBadRequest(c, "Mood preset is required");
  }

  const session = await findTabletControlSession(podId);
  if (!session?.pod) {
    return c.json(
      createErrorResponse({ error: "Not Found", message: "Active session not found" }),
      404
    );
  }

  const moodPreset = await findActiveMoodPreset(body.data.moodPresetId);
  if (!moodPreset) {
    return c.json(
      createErrorResponse({ error: "Not Found", message: "Mood preset not found" }),
      404
    );
  }

  if (session.pod.type && !moodPreset.enabledPodTypes.includes(session.pod.type)) {
    return getBadRequest(c, "Mood preset is not enabled for this pod type");
  }

  await appendSessionControlLog({
    sessionId: session.id,
    eventType: "MOOD_CHANGED",
    payload: { moodPresetId: moodPreset.id },
  });
  await refreshPodStateForPod(podId);

  return c.json(createSuccessResponse(await buildTabletState(podId, moodPreset.id)), 200);
});

tabletGroup.post("/pods/:podId/aroma", async (c: Context<AppBindings>) => {
  const podId = c.req.param("podId");
  const body = aromaBodySchema.safeParse(await c.req.json().catch(() => null));

  if (!body.success) {
    return getBadRequest(c, "Aroma payload is invalid");
  }

  const session = await findTabletControlSession(podId);
  if (!session?.pod) {
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
    body.data.activeDufuserContainerNumber === null
      ? null
      : (body.data.aromaDefuserId ?? aromaDefusers[0]?.id ?? null);
  const validationError = getAromaValidationError({
    aromaDefusers,
    aromaDefuserId: activeAromaDefuserId,
    containerNumber: body.data.activeDufuserContainerNumber,
  });

  if (validationError) {
    return getBadRequest(c, validationError);
  }

  await appendSessionControlLog({
    sessionId: session.id,
    eventType: "AROMA_CHANGED",
    payload: {
      activeAromaDefuserId,
      activeDufuserContainerNumber: body.data.activeDufuserContainerNumber,
    },
  });
  await refreshPodStateForPod(podId);

  return c.json(createSuccessResponse(await buildTabletState(podId)), 200);
});

tabletGroup.post("/pods/:podId/music", async (c: Context<AppBindings>) => {
  const podId = c.req.param("podId");
  const body = musicBodySchema.safeParse(await c.req.json().catch(() => null));

  if (!body.success) {
    return getBadRequest(c, "Music payload is invalid");
  }

  const session = await findTabletControlSession(podId);
  if (!session) {
    return c.json(
      createErrorResponse({ error: "Not Found", message: "Active session not found" }),
      404
    );
  }

  if (body.data.musicId && body.data.playlistId) {
    const music = await db.query.musics.findFirst({
      where: and(
        eq(musics.id, body.data.musicId),
        eq(musics.playlistId, body.data.playlistId),
        eq(musics.isDeleted, false)
      ),
    });

    if (!music) {
      return getBadRequest(c, "Music is not available for the selected playlist");
    }
  }

  const payload = {
    playlistId: body.data.playlistId ?? null,
    musicId: body.data.musicId ?? null,
    playbackState: body.data.playbackState,
    positionSeconds: body.data.positionSeconds,
    volume: body.data.volume,
    outputSource: body.data.outputSource,
    updatedAt: new Date().toISOString(),
    nonce: body.data.nonce || crypto.randomUUID(),
  };

  await appendSessionControlLog({
    sessionId: session.id,
    eventType: "MUSIC_CHANGED",
    payload,
  });
  await refreshPodStateForPod(podId);

  return c.json(createSuccessResponse(await buildTabletState(podId)), 200);
});

tabletGroup.post("/pods/:podId/emergency-unlock", async (c: Context<AppBindings>) => {
  const podId = c.req.param("podId");
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
    return c.json(
      createErrorResponse({ error: "Not Found", message: "Active session not found" }),
      404
    );
  }

  await refreshPodStateForPod(podId);

  return c.json(
    createSuccessResponse({
      message: "Emergency unlock completed",
      session: buildSessionResponse(result.session, now, result.location),
      state: await buildTabletState(podId),
    }),
    200
  );
});
