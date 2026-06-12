import type { AppBindings } from "@/types/app";
import { OpenAPIHono } from "@hono/zod-openapi";
import { db, musicPlaylists } from "@ikyomm/database";
import {
  createErrorResponse,
  createSuccessResponse,
  generateRandomId,
  getBetterAuthContext,
  registerOpenApiRoute,
} from "@ikyomm/utils";
import { eq } from "drizzle-orm";
import { fetchMusicPlaylistList } from "./list";
import { create, get, list, permanentRemove, remove, restore, update } from "./openapi.route";
import { findMusicPlaylistById, findMusicPlaylistByName } from "./utils";

export const musicPlaylistsGroup = new OpenAPIHono<AppBindings>();

registerOpenApiRoute(musicPlaylistsGroup, list, async (c) => {
  const query = c.req.valid("query");
  const response = await fetchMusicPlaylistList(query);

  return c.json(createSuccessResponse(response), 200);
});

registerOpenApiRoute(musicPlaylistsGroup, get, async (c) => {
  const { id } = c.req.valid("param");
  const playlist = await findMusicPlaylistById(id);

  if (!playlist) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "Music playlist not found",
      }),
      404
    );
  }

  return c.json(createSuccessResponse(playlist), 200);
});

registerOpenApiRoute(musicPlaylistsGroup, create, async (c) => {
  const body = c.req.valid("json");
  const { user: currentUser } = getBetterAuthContext(c);

  if (await findMusicPlaylistByName(body.name)) {
    return c.json(
      createErrorResponse({
        error: "Conflict",
        message: "Music playlist with this name already exists",
      }),
      409
    );
  }

  const [playlist] = await db
    .insert(musicPlaylists)
    .values({
      id: generateRandomId(),
      ...body,
      createdByUser: currentUser?.id ?? null,
    })
    .returning();

  return c.json(createSuccessResponse(playlist), 201);
});

registerOpenApiRoute(musicPlaylistsGroup, update, async (c) => {
  const { id } = c.req.valid("param");
  const body = c.req.valid("json");
  const { user: currentUser } = getBetterAuthContext(c);

  const existingPlaylist = await findMusicPlaylistById(id);
  if (!existingPlaylist) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "Music playlist not found",
      }),
      404
    );
  }

  if (body.name && (await findMusicPlaylistByName(body.name, id))) {
    return c.json(
      createErrorResponse({
        error: "Conflict",
        message: "Music playlist with this name already exists",
      }),
      409
    );
  }

  const [playlist] = await db
    .update(musicPlaylists)
    .set({
      ...body,
      updatedByUser: currentUser?.id ?? null,
    })
    .where(eq(musicPlaylists.id, id))
    .returning();

  return c.json(createSuccessResponse(playlist), 200);
});

registerOpenApiRoute(musicPlaylistsGroup, remove, async (c) => {
  const { id } = c.req.valid("param");
  const { user: currentUser } = getBetterAuthContext(c);

  const existingPlaylist = await findMusicPlaylistById(id);
  if (!existingPlaylist) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "Music playlist not found",
      }),
      404
    );
  }

  await db
    .update(musicPlaylists)
    .set({
      isDeleted: true,
      deletedAt: new Date(),
      deletedByUser: currentUser?.id ?? null,
      updatedByUser: currentUser?.id ?? null,
    })
    .where(eq(musicPlaylists.id, id));

  return c.json(createSuccessResponse({ message: "Music playlist deleted successfully" }), 200);
});

registerOpenApiRoute(musicPlaylistsGroup, permanentRemove, async (c) => {
  const { id } = c.req.valid("param");

  const existingPlaylist = await findMusicPlaylistById(id, { includeDeleted: true });
  if (!existingPlaylist) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "Music playlist not found",
      }),
      404
    );
  }

  await db.delete(musicPlaylists).where(eq(musicPlaylists.id, id));

  return c.json(
    createSuccessResponse({ message: "Music playlist permanently deleted successfully" }),
    200
  );
});

registerOpenApiRoute(musicPlaylistsGroup, restore, async (c) => {
  const { id } = c.req.valid("param");
  const { user: currentUser } = getBetterAuthContext(c);

  const existingPlaylist = await findMusicPlaylistById(id, { includeDeleted: true });
  if (!existingPlaylist) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "Music playlist not found",
      }),
      404
    );
  }

  if (!existingPlaylist.isDeleted) {
    return c.json(createSuccessResponse({ message: "Music playlist is already active" }), 200);
  }

  await db
    .update(musicPlaylists)
    .set({
      isDeleted: false,
      deletedAt: null,
      deletedByUser: null,
      updatedByUser: currentUser?.id ?? null,
    })
    .where(eq(musicPlaylists.id, id));

  return c.json(createSuccessResponse({ message: "Music playlist restored successfully" }), 200);
});
