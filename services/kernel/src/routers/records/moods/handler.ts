import type { AppBindings } from "@/types/app";
import { OpenAPIHono } from "@hono/zod-openapi";
import { aromaDefusers, db, musicPlaylists, podMoodPresets } from "@ikyomm/database";
import {
  createErrorResponse,
  createSuccessResponse,
  generateRandomId,
  getBetterAuthContext,
  registerOpenApiRoute,
} from "@ikyomm/utils";
import { and, eq, inArray } from "drizzle-orm";
import { fetchPodMoodPresetList } from "./list";
import { create, get, list, permanentRemove, remove, restore, update } from "./openapi.route";
import { findPodMoodPresetById, findPodMoodPresetByTitle } from "./utils";

export const moodPresetsGroup = new OpenAPIHono<AppBindings>();

const getUniquePlaylistIds = (playlistIds: string[] = []) => [...new Set(playlistIds)];

async function validatePlaylistIds(playlistIds: string[]) {
  const uniquePlaylistIds = getUniquePlaylistIds(playlistIds);

  if (uniquePlaylistIds.length === 0) {
    return { ok: true as const, playlistIds: uniquePlaylistIds };
  }

  const existingPlaylists = await db
    .select({ id: musicPlaylists.id })
    .from(musicPlaylists)
    .where(inArray(musicPlaylists.id, uniquePlaylistIds));
  const existingPlaylistIds = new Set(existingPlaylists.map((playlist) => playlist.id));
  const missingPlaylistIds = uniquePlaylistIds.filter(
    (playlistId) => !existingPlaylistIds.has(playlistId)
  );

  if (missingPlaylistIds.length > 0) {
    return {
      ok: false as const,
      missingPlaylistIds,
    };
  }

  return { ok: true as const, playlistIds: uniquePlaylistIds };
}

async function validateAromaDefuserContainers(
  aromaDefuserContainers: { aromaDefuserId: string; containerNumbers: number[] }[] = []
) {
  const aromaDefuserIds = aromaDefuserContainers.map((item) => item.aromaDefuserId);
  const uniqueAromaDefuserIds = [...new Set(aromaDefuserIds)];

  if (uniqueAromaDefuserIds.length !== aromaDefuserIds.length) {
    return { ok: false as const, message: "Aroma Defuser IDs must be unique" };
  }

  for (const item of aromaDefuserContainers) {
    if (new Set(item.containerNumbers).size !== item.containerNumbers.length) {
      return {
        ok: false as const,
        message: `Container numbers must be unique for Aroma Defuser ${item.aromaDefuserId}`,
      };
    }
  }

  if (uniqueAromaDefuserIds.length === 0) {
    return { ok: true as const };
  }

  const existingAromaDefusers = await db
    .select({
      id: aromaDefusers.id,
      containers: aromaDefusers.containers,
    })
    .from(aromaDefusers)
    .where(
      and(inArray(aromaDefusers.id, uniqueAromaDefuserIds), eq(aromaDefusers.isDeleted, false))
    );
  const aromaDefuserById = new Map(
    existingAromaDefusers.map((aromaDefuser) => [aromaDefuser.id, aromaDefuser])
  );
  const missingAromaDefuserIds = uniqueAromaDefuserIds.filter((id) => !aromaDefuserById.has(id));

  if (missingAromaDefuserIds.length > 0) {
    return {
      ok: false as const,
      message: `Aroma Defuser not found: ${missingAromaDefuserIds.join(", ")}`,
    };
  }

  for (const item of aromaDefuserContainers) {
    const aromaDefuser = aromaDefuserById.get(item.aromaDefuserId);
    const allowedContainerNumbers = new Set(
      (aromaDefuser?.containers ?? []).map((container) => container.number)
    );
    const missingContainerNumbers = item.containerNumbers.filter(
      (containerNumber) => !allowedContainerNumbers.has(containerNumber)
    );

    if (missingContainerNumbers.length > 0) {
      return {
        ok: false as const,
        message: `Container number not found for Aroma Defuser ${item.aromaDefuserId}: ${missingContainerNumbers.join(", ")}`,
      };
    }
  }

  return { ok: true as const };
}

registerOpenApiRoute(moodPresetsGroup, list, async (c) => {
  const query = c.req.valid("query");
  const response = await fetchPodMoodPresetList(query);

  return c.json(createSuccessResponse(response), 200);
});

registerOpenApiRoute(moodPresetsGroup, get, async (c) => {
  const { id } = c.req.valid("param");
  const moodPreset = await findPodMoodPresetById(id);

  if (!moodPreset) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "Mood preset not found",
      }),
      404
    );
  }

  return c.json(createSuccessResponse(moodPreset), 200);
});

registerOpenApiRoute(moodPresetsGroup, create, async (c) => {
  const body = c.req.valid("json");
  const { user: currentUser } = getBetterAuthContext(c);

  if (await findPodMoodPresetByTitle(body.title)) {
    return c.json(
      createErrorResponse({
        error: "Conflict",
        message: "Mood preset with this title already exists",
      }),
      409
    );
  }

  const playlistValidation = await validatePlaylistIds(body.playlistIds);
  if (!playlistValidation.ok) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: `Music playlist not found: ${playlistValidation.missingPlaylistIds.join(", ")}`,
      }),
      404
    );
  }

  const aromaValidation = await validateAromaDefuserContainers(body.aromaDefuserContainers);
  if (!aromaValidation.ok) {
    return c.json(
      createErrorResponse({
        error: "Bad Request",
        message: aromaValidation.message,
      }),
      400
    );
  }

  const [moodPreset] = await db
    .insert(podMoodPresets)
    .values({
      id: generateRandomId(),
      ...body,
      playlistIds: playlistValidation.playlistIds,
      createdByUser: currentUser?.id ?? null,
    })
    .returning();

  return c.json(createSuccessResponse(moodPreset), 201);
});

registerOpenApiRoute(moodPresetsGroup, update, async (c) => {
  const { id } = c.req.valid("param");
  const body = c.req.valid("json");
  const { user: currentUser } = getBetterAuthContext(c);

  const existingMoodPreset = await findPodMoodPresetById(id);
  if (!existingMoodPreset) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "Mood preset not found",
      }),
      404
    );
  }

  if (body.title && (await findPodMoodPresetByTitle(body.title, id))) {
    return c.json(
      createErrorResponse({
        error: "Conflict",
        message: "Mood preset with this title already exists",
      }),
      409
    );
  }

  let playlistIds = body.playlistIds;
  if (playlistIds) {
    const playlistValidation = await validatePlaylistIds(playlistIds);
    if (!playlistValidation.ok) {
      return c.json(
        createErrorResponse({
          error: "Not Found",
          message: `Music playlist not found: ${playlistValidation.missingPlaylistIds.join(", ")}`,
        }),
        404
      );
    }

    playlistIds = playlistValidation.playlistIds;
  }

  if (body.aromaDefuserContainers) {
    const aromaValidation = await validateAromaDefuserContainers(body.aromaDefuserContainers);
    if (!aromaValidation.ok) {
      return c.json(
        createErrorResponse({
          error: "Bad Request",
          message: aromaValidation.message,
        }),
        400
      );
    }
  }

  const [moodPreset] = await db
    .update(podMoodPresets)
    .set({
      ...body,
      ...(playlistIds ? { playlistIds } : {}),
      updatedByUser: currentUser?.id ?? null,
    })
    .where(eq(podMoodPresets.id, id))
    .returning();

  return c.json(createSuccessResponse(moodPreset), 200);
});

registerOpenApiRoute(moodPresetsGroup, remove, async (c) => {
  const { id } = c.req.valid("param");
  const { user: currentUser } = getBetterAuthContext(c);

  const existingMoodPreset = await findPodMoodPresetById(id);
  if (!existingMoodPreset) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "Mood preset not found",
      }),
      404
    );
  }

  await db
    .update(podMoodPresets)
    .set({
      isDeleted: true,
      deletedAt: new Date(),
      deletedByUser: currentUser?.id ?? null,
      updatedByUser: currentUser?.id ?? null,
    })
    .where(eq(podMoodPresets.id, id));

  return c.json(createSuccessResponse({ message: "Mood preset deleted successfully" }), 200);
});

registerOpenApiRoute(moodPresetsGroup, permanentRemove, async (c) => {
  const { id } = c.req.valid("param");

  const existingMoodPreset = await findPodMoodPresetById(id, { includeDeleted: true });
  if (!existingMoodPreset) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "Mood preset not found",
      }),
      404
    );
  }

  await db.delete(podMoodPresets).where(eq(podMoodPresets.id, id));

  return c.json(
    createSuccessResponse({ message: "Mood preset permanently deleted successfully" }),
    200
  );
});

registerOpenApiRoute(moodPresetsGroup, restore, async (c) => {
  const { id } = c.req.valid("param");
  const { user: currentUser } = getBetterAuthContext(c);

  const existingMoodPreset = await findPodMoodPresetById(id, { includeDeleted: true });
  if (!existingMoodPreset) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "Mood preset not found",
      }),
      404
    );
  }

  if (!existingMoodPreset.isDeleted) {
    return c.json(createSuccessResponse({ message: "Mood preset is already active" }), 200);
  }

  await db
    .update(podMoodPresets)
    .set({
      isDeleted: false,
      deletedAt: null,
      deletedByUser: null,
      updatedByUser: currentUser?.id ?? null,
    })
    .where(eq(podMoodPresets.id, id));

  return c.json(createSuccessResponse({ message: "Mood preset restored successfully" }), 200);
});
