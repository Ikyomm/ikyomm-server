/** biome-ignore-all lint/suspicious/noExplicitAny: Generic Drizzle tables and OpenAPI schemas are registered dynamically. */
import type { OpenAPIHono } from "@hono/zod-openapi";
import { z } from "@hono/zod-openapi";
import { db, orders } from "@ikyomm/database";
import {
  createApiJsonBody,
  createApiSuccessResponse,
  createErrorResponse,
  createOpenApiRoute,
  createSuccessResponse,
  generateRandomId,
  getBetterAuthContext,
  registerOpenApiRoute,
} from "@ikyomm/utils";
import { and, desc, eq, getTableColumns, inArray } from "drizzle-orm";
import type { AppBindings } from "@/types/app";
import { ecommerceAuthMiddleware } from "./auth";
import {
  ecommerceDeleteResultSchema,
  ecommerceListQuerySchema,
  ecommerceRestoreResultSchema,
} from "./schema";

export type CrudBeforeCreate = (input: {
  body: Record<string, unknown>;
  userId: string;
}) => Promise<string | null>;

export interface CrudResourceConfig {
  name: string;
  path: string;
  tag: string;
  table: any;
  selectSchema: z.ZodTypeAny;
  insertSchema: z.ZodTypeAny;
  updateSchema: z.ZodTypeAny;
  publicRead?: boolean;
  staffWrite?: boolean;
  ownerColumn?: any;
  ownerKey?: string;
  parentOrderColumn?: any;
  parentOrderKey?: string;
  beforeCreate?: CrudBeforeCreate;
  beforeUpdate?: CrudBeforeCreate;
  listQuerySchema?: z.ZodTypeAny;
  listLoader?: (input: {
    limit: number;
    offset: number;
    userId: string | null;
    query: Record<string, unknown>;
  }) => Promise<unknown[]>;
  detailLoader?: (input: { id: string; userId: string | null }) => Promise<unknown | null>;
  hydrateRecord?: (id: string) => Promise<unknown | null>;
}

function userIdFromContext(c: any) {
  return getBetterAuthContext(c).user?.id ?? null;
}

function isStaffContext(c: any) {
  const auth = getBetterAuthContext(c);
  return auth.authorization.panel === "ikyomm" || auth.user?.panel === "ikyomm";
}

function forbidden(c: any) {
  return c.json(
    createErrorResponse({
      error: "Forbidden",
      message: "This operation requires an IKYOMM staff account.",
    }),
    403
  );
}

function resourceConditions(resource: CrudResourceConfig, userId: string | null) {
  const columns = getTableColumns(resource.table) as Record<string, any>;
  const conditions: any[] = [];

  if (columns.isDeleted) {
    conditions.push(eq(columns.isDeleted, false));
  }

  if (resource.ownerColumn && userId) {
    conditions.push(eq(resource.ownerColumn, userId));
  }

  if (resource.parentOrderColumn && userId) {
    conditions.push(
      inArray(
        resource.parentOrderColumn,
        db.select({ id: orders.id }).from(orders).where(eq(orders.userId, userId))
      )
    );
  }

  return { columns, conditions };
}

function scopedWhere(resource: CrudResourceConfig, id: string, userId: string | null) {
  const { columns, conditions } = resourceConditions(resource, userId);
  return and(eq(columns.id, id), ...conditions);
}

function assertWriteAccess(resource: CrudResourceConfig, c: any) {
  if (resource.staffWrite && !isStaffContext(c)) {
    return forbidden(c);
  }
  return null;
}

export function registerCrudResource(app: OpenAPIHono<AppBindings>, resource: CrudResourceConfig) {
  const basePath = resource.path ? `/${resource.path}` : "/";
  const itemPath = basePath === "/" ? "/{id}" : `${basePath}/{id}`;
  const operationBase = resource.name.replace(/[^a-zA-Z0-9]/g, "");
  const listQuerySchema = resource.listQuerySchema ?? ecommerceListQuerySchema;
  const listResponseSchema = z.object({
    items: z.array(resource.selectSchema),
    limit: z.number(),
    offset: z.number(),
  });

  const listRoute = createOpenApiRoute({
    method: "get",
    path: basePath,
    operationId: `${operationBase}List`,
    tags: [resource.tag],
    middleware: resource.publicRead ? [] : [ecommerceAuthMiddleware],
    summary: `List ${resource.name}`,
    request: { query: listQuerySchema },
    responses: {
      200: createApiSuccessResponse(listResponseSchema, `${resource.name} fetched successfully`),
    },
  });

  const getRoute = createOpenApiRoute({
    method: "get",
    path: itemPath,
    operationId: `${operationBase}GetById`,
    tags: [resource.tag],
    middleware: resource.publicRead ? [] : [ecommerceAuthMiddleware],
    summary: `Get ${resource.name} by ID`,
    request: { params: z.object({ id: z.string().min(1) }) },
    responses: {
      200: createApiSuccessResponse(resource.selectSchema, `${resource.name} fetched successfully`),
    },
  });

  const createRoute = createOpenApiRoute({
    method: "post",
    path: basePath,
    operationId: `${operationBase}Create`,
    tags: [resource.tag],
    middleware: [ecommerceAuthMiddleware],
    summary: `Create ${resource.name}`,
    request: { body: createApiJsonBody(resource.insertSchema) },
    responses: {
      201: createApiSuccessResponse(resource.selectSchema, `${resource.name} created successfully`),
    },
  });

  const updateRoute = createOpenApiRoute({
    method: "patch",
    path: itemPath,
    operationId: `${operationBase}UpdateById`,
    tags: [resource.tag],
    middleware: [ecommerceAuthMiddleware],
    summary: `Update ${resource.name}`,
    request: {
      params: z.object({ id: z.string().min(1) }),
      body: createApiJsonBody(resource.updateSchema),
    },
    responses: {
      200: createApiSuccessResponse(resource.selectSchema, `${resource.name} updated successfully`),
    },
  });

  const deleteRoute = createOpenApiRoute({
    method: "delete",
    path: itemPath,
    operationId: `${operationBase}DeleteById`,
    tags: [resource.tag],
    middleware: [ecommerceAuthMiddleware],
    summary: `Soft-delete ${resource.name}`,
    request: { params: z.object({ id: z.string().min(1) }) },
    responses: {
      200: createApiSuccessResponse(
        ecommerceDeleteResultSchema,
        `${resource.name} deleted successfully`
      ),
    },
  });

  const restoreRoute = createOpenApiRoute({
    method: "post",
    path: `${itemPath}/restore`,
    operationId: `${operationBase}RestoreById`,
    tags: [resource.tag],
    middleware: [ecommerceAuthMiddleware],
    summary: `Restore ${resource.name}`,
    request: { params: z.object({ id: z.string().min(1) }) },
    responses: {
      200: createApiSuccessResponse(
        ecommerceRestoreResultSchema,
        `${resource.name} restored successfully`
      ),
    },
  });

  registerOpenApiRoute(app, listRoute, async (c: any) => {
    const query = c.req.valid("query");
    const userId = userIdFromContext(c);
    const { columns, conditions } = resourceConditions(resource, userId);
    let statement = db
      .select()
      .from(resource.table)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .limit(query.limit)
      .offset(query.offset);

    if (columns.createdAt) {
      statement = statement.orderBy(desc(columns.createdAt)) as typeof statement;
    }

    const items = resource.listLoader
      ? await resource.listLoader({
          limit: query.limit,
          offset: query.offset,
          userId,
          query,
        })
      : await statement;
    return c.json(createSuccessResponse({ items, limit: query.limit, offset: query.offset }), 200);
  });

  registerOpenApiRoute(app, getRoute, async (c: any) => {
    const { id } = c.req.valid("param");
    const userId = userIdFromContext(c);
    const item = resource.detailLoader
      ? await resource.detailLoader({ id, userId })
      : await db
          .select()
          .from(resource.table)
          .where(scopedWhere(resource, id, userId))
          .limit(1)
          .then((rows) => rows[0]);

    if (!item) {
      return c.json(
        createErrorResponse({ error: "Not Found", message: `${resource.name} not found.` }),
        404
      );
    }
    return c.json(createSuccessResponse(item), 200);
  });

  registerOpenApiRoute(app, createRoute, async (c: any) => {
    const denied = assertWriteAccess(resource, c);
    if (denied) return denied;

    const userId = userIdFromContext(c);
    if (!userId) throw new Error("Authenticated user context is missing.");
    const body = c.req.valid("json") as Record<string, unknown>;

    if (resource.parentOrderKey) {
      const orderId = body[resource.parentOrderKey];
      const ownedOrder =
        typeof orderId === "string"
          ? await db
              .select({ id: orders.id })
              .from(orders)
              .where(and(eq(orders.id, orderId), eq(orders.userId, userId)))
              .limit(1)
              .then((rows) => rows[0])
          : null;
      if (!ownedOrder) return forbidden(c);
    }

    const validationMessage = await resource.beforeCreate?.({ body, userId });
    if (validationMessage) {
      return c.json(
        createErrorResponse({ error: "Unprocessable Entity", message: validationMessage }),
        422
      );
    }

    const values: Record<string, unknown> = {
      ...body,
      id: generateRandomId(),
      createdByUser: userId,
    };
    if (resource.ownerKey) values[resource.ownerKey] = userId;

    const insertedRows = await db.insert(resource.table).values(values).returning();
    const insertedItem = (insertedRows as any[])[0];
    const item = resource.hydrateRecord
      ? await resource.hydrateRecord(String(insertedItem.id))
      : insertedItem;
    return c.json(createSuccessResponse(item), 201);
  });

  registerOpenApiRoute(app, updateRoute, async (c: any) => {
    const denied = assertWriteAccess(resource, c);
    if (denied) return denied;
    const userId = userIdFromContext(c);
    const { id } = c.req.valid("param");
    const body = c.req.valid("json") as Record<string, unknown>;
    if (resource.ownerKey) delete body[resource.ownerKey];

    if (!userId) throw new Error("Authenticated user context is missing.");
    const validationMessage = await resource.beforeUpdate?.({ body, userId });
    if (validationMessage) {
      return c.json(
        createErrorResponse({ error: "Unprocessable Entity", message: validationMessage }),
        422
      );
    }

    const updatedItem = await db
      .update(resource.table)
      .set({ ...body, updatedByUser: userId })
      .where(scopedWhere(resource, id, userId))
      .returning()
      .then((rows) => rows[0]);
    if (!updatedItem) {
      return c.json(
        createErrorResponse({ error: "Not Found", message: `${resource.name} not found.` }),
        404
      );
    }
    const item = resource.hydrateRecord
      ? await resource.hydrateRecord(String(updatedItem.id))
      : updatedItem;
    return c.json(createSuccessResponse(item), 200);
  });

  registerOpenApiRoute(app, deleteRoute, async (c: any) => {
    const denied = assertWriteAccess(resource, c);
    if (denied) return denied;
    const userId = userIdFromContext(c);
    const { id } = c.req.valid("param");
    const item = await db
      .update(resource.table)
      .set({ isDeleted: true, deletedAt: new Date(), deletedByUser: userId })
      .where(scopedWhere(resource, id, userId))
      .returning({ id: getTableColumns(resource.table).id })
      .then((rows) => rows[0]);
    if (!item) {
      return c.json(
        createErrorResponse({ error: "Not Found", message: `${resource.name} not found.` }),
        404
      );
    }
    return c.json(createSuccessResponse({ id: item.id, deleted: true }), 200);
  });

  registerOpenApiRoute(app, restoreRoute, async (c: any) => {
    const denied = assertWriteAccess(resource, c);
    if (denied) return denied;
    const userId = userIdFromContext(c);
    const { id } = c.req.valid("param");
    const columns = getTableColumns(resource.table) as Record<string, any>;
    const conditions = [eq(columns.id, id), eq(columns.isDeleted, true)];
    if (resource.ownerColumn && userId) conditions.push(eq(resource.ownerColumn, userId));
    if (resource.parentOrderColumn && userId) {
      conditions.push(
        inArray(
          resource.parentOrderColumn,
          db.select({ id: orders.id }).from(orders).where(eq(orders.userId, userId))
        )
      );
    }
    const item = await db
      .update(resource.table)
      .set({ isDeleted: false, deletedAt: null, deletedByUser: null, updatedByUser: userId })
      .where(and(...conditions))
      .returning({ id: columns.id })
      .then((rows) => rows[0]);
    if (!item) {
      return c.json(
        createErrorResponse({ error: "Not Found", message: `${resource.name} not found.` }),
        404
      );
    }
    return c.json(createSuccessResponse({ id: item.id, restored: true }), 200);
  });
}
