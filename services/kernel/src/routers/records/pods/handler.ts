import type { AppBindings } from "@/types/app";
import { OpenAPIHono } from "@hono/zod-openapi";
import {
  createErrorResponse,
  createSuccessResponse,
  getBetterAuthContext,
  registerOpenApiRoute,
} from "@ikyomm/utils";
import { db, pods } from "@ikyomm/database";
import { eq } from "drizzle-orm";
import { fetchPodsList } from "./list";
import { create, get, list, permanentRemove, remove, restore, update } from "./openapi.route";
import {
  findNextPodId,
  findPodById,
  validatePodAromaDefuserAssignment,
  validatePodLocationAssignment,
} from "./utils";

export const podsGroup = new OpenAPIHono<AppBindings>();

registerOpenApiRoute(podsGroup, list, async (c) => {
  const query = c.req.valid("query");
  const response = await fetchPodsList(query);

  return c.json(createSuccessResponse(response), 200);
});

registerOpenApiRoute(podsGroup, get, async (c) => {
  const { id } = c.req.valid("param");
  const pod = await findPodById(id);

  if (!pod) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "Pod not found",
      }),
      404
    );
  }

  return c.json(createSuccessResponse(pod), 200);
});

registerOpenApiRoute(podsGroup, create, async (c) => {
  const body = c.req.valid("json");
  const { user: currentUser } = getBetterAuthContext(c);

  const nextId = await findNextPodId();

  const locationValidation = await validatePodLocationAssignment(body);
  if (!locationValidation.valid) {
    return c.json(
      createErrorResponse({
        error: "Bad Request",
        message: locationValidation.message,
      }),
      400
    );
  }

  const aromaDefuserValidation = await validatePodAromaDefuserAssignment(body);
  if (!aromaDefuserValidation.valid) {
    return c.json(
      createErrorResponse({
        error: "Bad Request",
        message: aromaDefuserValidation.message,
      }),
      400
    );
  }

  await db.insert(pods).values({
    id: nextId,
    ...body,
    createdByUser: currentUser?.id ?? null,
  });

  const pod = await findPodById(nextId);
  if (!pod) {
    return c.json(
      createErrorResponse({
        error: "Internal Server Error",
        message: "Failed to load created Pod",
      }),
      500
    );
  }

  return c.json(createSuccessResponse(pod), 201);
});

registerOpenApiRoute(podsGroup, update, async (c) => {
  const { id } = c.req.valid("param");
  const body = c.req.valid("json");
  const { user: currentUser } = getBetterAuthContext(c);

  const existingPod = await findPodById(id);
  if (!existingPod) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "Pod not found",
      }),
      404
    );
  }

  const locationValidation = await validatePodLocationAssignment({
    locationId: body.locationId === undefined ? existingPod.locationId : body.locationId,
  });
  if (!locationValidation.valid) {
    return c.json(
      createErrorResponse({
        error: "Bad Request",
        message: locationValidation.message,
      }),
      400
    );
  }

  const aromaDefuserValidation = await validatePodAromaDefuserAssignment({
    aromaDefuserId:
      body.aromaDefuserId === undefined ? existingPod.aromaDefuserId : body.aromaDefuserId,
  });
  if (!aromaDefuserValidation.valid) {
    return c.json(
      createErrorResponse({
        error: "Bad Request",
        message: aromaDefuserValidation.message,
      }),
      400
    );
  }

  await db
    .update(pods)
    .set({
      ...body,
      updatedByUser: currentUser?.id ?? null,
    })
    .where(eq(pods.id, id));

  const pod = await findPodById(id);
  if (!pod) {
    return c.json(
      createErrorResponse({
        error: "Internal Server Error",
        message: "Failed to load updated Pod",
      }),
      500
    );
  }

  return c.json(createSuccessResponse(pod), 200);
});

registerOpenApiRoute(podsGroup, remove, async (c) => {
  const { id } = c.req.valid("param");
  const { user: currentUser } = getBetterAuthContext(c);

  const existingPod = await findPodById(id);
  if (!existingPod) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "Pod not found",
      }),
      404
    );
  }

  await db
    .update(pods)
    .set({
      isDeleted: true,
      deletedAt: new Date(),
      deletedByUser: currentUser?.id ?? null,
      updatedByUser: currentUser?.id ?? null,
    })
    .where(eq(pods.id, id));

  return c.json(
    createSuccessResponse({
      message: "Pod deleted successfully",
    }),
    200
  );
});

registerOpenApiRoute(podsGroup, permanentRemove, async (c) => {
  const { id } = c.req.valid("param");

  const existingPod = await findPodById(id, { includeDeleted: true });
  if (!existingPod) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "Pod not found",
      }),
      404
    );
  }

  await db.delete(pods).where(eq(pods.id, id));

  return c.json(
    createSuccessResponse({
      message: "Pod permanently deleted successfully",
    }),
    200
  );
});

registerOpenApiRoute(podsGroup, restore, async (c) => {
  const { id } = c.req.valid("param");
  const { user: currentUser } = getBetterAuthContext(c);

  const existingPod = await findPodById(id, { includeDeleted: true });
  if (!existingPod) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "Pod not found",
      }),
      404
    );
  }

  await db
    .update(pods)
    .set({
      isDeleted: false,
      deletedAt: null,
      deletedByUser: null,
      updatedByUser: currentUser?.id ?? null,
    })
    .where(eq(pods.id, id));

  return c.json(
    createSuccessResponse({
      message: "Pod restored successfully",
    }),
    200
  );
});
