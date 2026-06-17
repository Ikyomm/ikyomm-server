import type { AppBindings } from "@/types/app";
import { OpenAPIHono } from "@hono/zod-openapi";
import { db, musicPlaylists, podMoodPresets } from "@ikyomm/database";
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
