import type { AppBindings } from "@/types/app";
import { OpenAPIHono } from "@hono/zod-openapi";
import { aromaDefusers, db, pods } from "@ikyomm/database";
import {
  createErrorResponse,
  createSuccessResponse,
  generateRandomId,
  getBetterAuthContext,
  registerOpenApiRoute,
} from "@ikyomm/utils";
import { and, eq } from "drizzle-orm";
import { fetchAromaDefuserList } from "./list";
import { create, get, list, permanentRemove, remove, restore, update } from "./openapi.route";
import { findAromaDefuserById, findAromaDefuserByMacId } from "./utils";

export const aromaDefusersGroup = new OpenAPIHono<AppBindings>();

function hasDuplicateContainerNumbers(containers: { number: number }[]) {
  return new Set(containers.map((container) => container.number)).size !== containers.length;
}

registerOpenApiRoute(aromaDefusersGroup, list, async (c) => {
  const query = c.req.valid("query");
  const response = await fetchAromaDefuserList(query);

  return c.json(createSuccessResponse(response), 200);
});

registerOpenApiRoute(aromaDefusersGroup, get, async (c) => {
  const { id } = c.req.valid("param");
  const aromaDefuser = await findAromaDefuserById(id);

  if (!aromaDefuser) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "Aroma Defuser not found",
      }),
      404
    );
  }

  return c.json(createSuccessResponse(aromaDefuser), 200);
});

registerOpenApiRoute(aromaDefusersGroup, create, async (c) => {
  const body = c.req.valid("json");
  const { user: currentUser } = getBetterAuthContext(c);

  if (hasDuplicateContainerNumbers(body.containers)) {
    return c.json(
      createErrorResponse({
        error: "Bad Request",
        message: "Container numbers must be unique",
      }),
      400
    );
  }

  if (await findAromaDefuserByMacId(body.macId)) {
    return c.json(
      createErrorResponse({
        error: "Conflict",
        message: "Aroma Defuser with this MAC ID already exists",
      }),
      409
    );
  }

  const [aromaDefuser] = await db
    .insert(aromaDefusers)
    .values({
      id: generateRandomId(),
      ...body,
      createdByUser: currentUser?.id ?? null,
    })
    .returning();

  return c.json(createSuccessResponse(aromaDefuser), 201);
});

registerOpenApiRoute(aromaDefusersGroup, update, async (c) => {
  const { id } = c.req.valid("param");
  const body = c.req.valid("json");
  const { user: currentUser } = getBetterAuthContext(c);

  const existingAromaDefuser = await findAromaDefuserById(id);
  if (!existingAromaDefuser) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "Aroma Defuser not found",
      }),
      404
    );
  }

  if (body.containers && hasDuplicateContainerNumbers(body.containers)) {
    return c.json(
      createErrorResponse({
        error: "Bad Request",
        message: "Container numbers must be unique",
      }),
      400
    );
  }

  if (body.macId && (await findAromaDefuserByMacId(body.macId, id))) {
    return c.json(
      createErrorResponse({
        error: "Conflict",
        message: "Aroma Defuser with this MAC ID already exists",
      }),
      409
    );
  }

  const [aromaDefuser] = await db
    .update(aromaDefusers)
    .set({
      ...body,
      updatedByUser: currentUser?.id ?? null,
    })
    .where(eq(aromaDefusers.id, id))
    .returning();

  return c.json(createSuccessResponse(aromaDefuser), 200);
});

registerOpenApiRoute(aromaDefusersGroup, remove, async (c) => {
  const { id } = c.req.valid("param");
  const { user: currentUser } = getBetterAuthContext(c);

  const existingAromaDefuser = await findAromaDefuserById(id);
  if (!existingAromaDefuser) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "Aroma Defuser not found",
      }),
      404
    );
  }

  const assignedPod = await db
    .select({ id: pods.id })
    .from(pods)
    .where(and(eq(pods.aromaDefuserId, id), eq(pods.isDeleted, false)))
    .limit(1)
    .then((rows) => rows[0]);

  if (assignedPod) {
    return c.json(
      createErrorResponse({
        error: "Conflict",
        message: "Aroma Defuser is assigned to an active Pod",
      }),
      409
    );
  }

  await db
    .update(aromaDefusers)
    .set({
      isDeleted: true,
      deletedAt: new Date(),
      deletedByUser: currentUser?.id ?? null,
      updatedByUser: currentUser?.id ?? null,
    })
    .where(eq(aromaDefusers.id, id));

  return c.json(createSuccessResponse({ message: "Aroma Defuser deleted successfully" }), 200);
});

registerOpenApiRoute(aromaDefusersGroup, permanentRemove, async (c) => {
  const { id } = c.req.valid("param");

  const existingAromaDefuser = await findAromaDefuserById(id, { includeDeleted: true });
  if (!existingAromaDefuser) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "Aroma Defuser not found",
      }),
      404
    );
  }

  await db.delete(aromaDefusers).where(eq(aromaDefusers.id, id));

  return c.json(
    createSuccessResponse({ message: "Aroma Defuser permanently deleted successfully" }),
    200
  );
});

registerOpenApiRoute(aromaDefusersGroup, restore, async (c) => {
  const { id } = c.req.valid("param");
  const { user: currentUser } = getBetterAuthContext(c);

  const existingAromaDefuser = await findAromaDefuserById(id, { includeDeleted: true });
  if (!existingAromaDefuser) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "Aroma Defuser not found",
      }),
      404
    );
  }

  if (!existingAromaDefuser.isDeleted) {
    return c.json(createSuccessResponse({ message: "Aroma Defuser is already active" }), 200);
  }

  await db
    .update(aromaDefusers)
    .set({
      isDeleted: false,
      deletedAt: null,
      deletedByUser: null,
      updatedByUser: currentUser?.id ?? null,
    })
    .where(eq(aromaDefusers.id, id));

  return c.json(createSuccessResponse({ message: "Aroma Defuser restored successfully" }), 200);
});
