import type { AppBindings } from "@/types/app";
import { OpenAPIHono } from "@hono/zod-openapi";
import { db, musics } from "@ikyomm/database";
import {
  createErrorResponse,
  createSuccessResponse,
  generateRandomId,
  getBetterAuthContext,
  registerOpenApiRoute,
} from "@ikyomm/utils";
import { eq } from "drizzle-orm";
import { findMusicPlaylistById } from "../music-playlists/utils";
import { fetchMusicList } from "./list";
import { create, get, list, permanentRemove, remove, restore, update } from "./openapi.route";
import { findMusicById } from "./utils";

export const musicsGroup = new OpenAPIHono<AppBindings>();

registerOpenApiRoute(musicsGroup, list, async (c) => {
  const query = c.req.valid("query");
  const response = await fetchMusicList(query);

  return c.json(createSuccessResponse(response), 200);
});

registerOpenApiRoute(musicsGroup, get, async (c) => {
  const { id } = c.req.valid("param");
  const music = await findMusicById(id);

  if (!music) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "Music not found",
      }),
      404
    );
  }

  return c.json(createSuccessResponse(music), 200);
});

registerOpenApiRoute(musicsGroup, create, async (c) => {
  const body = c.req.valid("json");
  const { user: currentUser } = getBetterAuthContext(c);

  if (!(await findMusicPlaylistById(body.playlistId))) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "Music playlist not found",
      }),
      404
    );
  }

  const [music] = await db
    .insert(musics)
    .values({
      id: generateRandomId(),
      ...body,
      createdByUser: currentUser?.id ?? null,
    })
    .returning();

  return c.json(createSuccessResponse(music), 201);
});

registerOpenApiRoute(musicsGroup, update, async (c) => {
  const { id } = c.req.valid("param");
  const body = c.req.valid("json");
  const { user: currentUser } = getBetterAuthContext(c);

  const existingMusic = await findMusicById(id);
  if (!existingMusic) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "Music not found",
      }),
      404
    );
  }

  if (body.playlistId && !(await findMusicPlaylistById(body.playlistId))) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "Music playlist not found",
      }),
      404
    );
  }

  const [music] = await db
    .update(musics)
    .set({
      ...body,
      updatedByUser: currentUser?.id ?? null,
    })
    .where(eq(musics.id, id))
    .returning();

  return c.json(createSuccessResponse(music), 200);
});

registerOpenApiRoute(musicsGroup, remove, async (c) => {
  const { id } = c.req.valid("param");
  const { user: currentUser } = getBetterAuthContext(c);

  const existingMusic = await findMusicById(id);
  if (!existingMusic) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "Music not found",
      }),
      404
    );
  }

  await db
    .update(musics)
    .set({
      isDeleted: true,
      deletedAt: new Date(),
      deletedByUser: currentUser?.id ?? null,
      updatedByUser: currentUser?.id ?? null,
    })
    .where(eq(musics.id, id));

  return c.json(createSuccessResponse({ message: "Music deleted successfully" }), 200);
});

registerOpenApiRoute(musicsGroup, permanentRemove, async (c) => {
  const { id } = c.req.valid("param");

  const existingMusic = await findMusicById(id, { includeDeleted: true });
  if (!existingMusic) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "Music not found",
      }),
      404
    );
  }

  await db.delete(musics).where(eq(musics.id, id));

  return c.json(createSuccessResponse({ message: "Music permanently deleted successfully" }), 200);
});

registerOpenApiRoute(musicsGroup, restore, async (c) => {
  const { id } = c.req.valid("param");
  const { user: currentUser } = getBetterAuthContext(c);

  const existingMusic = await findMusicById(id, { includeDeleted: true });
  if (!existingMusic) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "Music not found",
      }),
      404
    );
  }

  if (!existingMusic.isDeleted) {
    return c.json(createSuccessResponse({ message: "Music is already active" }), 200);
  }

  await db
    .update(musics)
    .set({
      isDeleted: false,
      deletedAt: null,
      deletedByUser: null,
      updatedByUser: currentUser?.id ?? null,
    })
    .where(eq(musics.id, id));

  return c.json(createSuccessResponse({ message: "Music restored successfully" }), 200);
});
