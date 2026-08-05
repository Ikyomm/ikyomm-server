/** biome-ignore-all lint/suspicious/noExplicitAny: Generic Drizzle tables and OpenAPI schemas are registered dynamically. */
import type { OpenAPIHono } from "@hono/zod-openapi";
import { z } from "@hono/zod-openapi";
import { db, orders, type DatabaseResource } from "@ikyomm/database";
import {
  createApiJsonBody,
  createApiSuccessResponse,
  createErrorResponse,
  createOpenApiRoute,
  createSuccessResponse,
  generateRandomId,
  getBetterAuthContext,
  hasPermission,
  registerOpenApiRoute,
  type RbacAction,
} from "@ikyomm/utils";
import { and, asc, count, desc, eq, getTableColumns, ilike, inArray, or } from "drizzle-orm";
import type { AppBindings } from "@/types/app";
import { ecommerceAuthMiddleware } from "./auth";
import {
  ecommerceDeleteResultSchema,
  ecommerceListQuerySchema,
  ecommercePermanentDeleteResultSchema,
  ecommerceRestoreResultSchema,
} from "./schema";
import { resolveEcommerceDbError } from "./db-errors";

export type CrudBeforeCreate = (input: {
  body: Record<string, unknown>;
  id?: string;
  userId: string;
}) => Promise<string | null>;

type CrudBodyTransform = (input: {
  body: Record<string, unknown>;
  id?: string;
  userId: string;
}) => Promise<Record<string, unknown>> | Record<string, unknown>;

type CrudAfterWrite = (input: {
  body: Record<string, unknown>;
  id: string;
  item: Record<string, unknown>;
  userId: string;
}) => Promise<void> | void;

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
  permissionResource?: DatabaseResource;
  searchColumns?: any[];
  sortColumns?: Record<string, any>;
  ownerColumn?: any;
  ownerKey?: string;
  parentOrderColumn?: any;
  parentOrderKey?: string;
  beforeCreate?: CrudBeforeCreate;
  beforeUpdate?: CrudBeforeCreate;
  transformCreateBody?: CrudBodyTransform;
  transformUpdateBody?: CrudBodyTransform;
  afterCreate?: CrudAfterWrite;
  afterUpdate?: CrudAfterWrite;
  listQuerySchema?: z.ZodTypeAny;
  listLoader?: (input: {
    limit: number;
    offset: number;
    userId: string | null;
    query: Record<string, unknown>;
  }) => Promise<unknown[]>;
  listCountLoader?: (input: {
    userId: string | null;
    query: Record<string, unknown>;
  }) => Promise<number>;
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

function resourceConditions(
  resource: CrudResourceConfig,
  userId: string | null,
  query?: Record<string, unknown>
) {
  const columns = getTableColumns(resource.table) as Record<string, any>;
  const conditions: any[] = [];

  if (columns.isDeleted) {
    conditions.push(eq(columns.isDeleted, query?.isDeleted === true));
  }

  if (typeof query?.search === "string" && resource.searchColumns?.length) {
    const pattern = `%${query.search}%`;
    conditions.push(or(...resource.searchColumns.map((column) => ilike(column, pattern))));
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

function assertWriteAccess(resource: CrudResourceConfig, c: any, action: RbacAction) {
  if (resource.staffWrite && !isStaffContext(c)) {
    return forbidden(c);
  }

  if (resource.permissionResource) {
    const auth = getBetterAuthContext(c);
    const role = auth.authorization.role?.trim().toLowerCase();
    const permission = auth.authorization.permissions?.[resource.permissionResource];
    const hasAdminFallback = role === "admin" && !permission;

    if (
      role !== "superadmin" &&
      !hasAdminFallback &&
      !hasPermission(auth, { resource: resource.permissionResource, action })
    ) {
      return c.json(
        createErrorResponse({
          error: "Forbidden",
          message: `Missing permission: ${resource.permissionResource}.${action}`,
        }),
        403
      );
    }
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
    totalItems: z.number(),
  });
  const listAuthMiddleware = async (c: any, next: any) => {
    const requestsDeletedRecords = c.req.query("isDeleted") === "true";
    if (resource.publicRead && !requestsDeletedRecords) {
      await next();
      return;
    }
    return ecommerceAuthMiddleware(c, next);
  };

  const listRoute = createOpenApiRoute({
    method: "get",
    path: basePath,
    operationId: `${operationBase}List`,
    tags: [resource.tag],
    middleware: [listAuthMiddleware],
    summary: `List ${resource.name}`,
    request: { query: listQuerySchema as any },
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

  const permanentDeleteRoute = createOpenApiRoute({
    method: "delete",
    path: `${itemPath}/permanent`,
    operationId: `${operationBase}PermanentDeleteById`,
    tags: [resource.tag],
    middleware: [ecommerceAuthMiddleware],
    summary: `Permanently delete ${resource.name}`,
    request: { params: z.object({ id: z.string().min(1) }) },
    responses: {
      200: createApiSuccessResponse(
        ecommercePermanentDeleteResultSchema,
        `${resource.name} permanently deleted successfully`
      ),
    },
  });

  registerOpenApiRoute(app, listRoute, async (c: any) => {
    const query = c.req.valid("query");
    if (query.isDeleted === true && resource.permissionResource) {
      const denied = assertWriteAccess(resource, c, "getAll");
      if (denied) return denied;
    }
    const userId = userIdFromContext(c);
    const { columns, conditions } = resourceConditions(resource, userId, query);
    let statement = db
      .select()
      .from(resource.table)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .limit(query.limit)
      .offset(query.offset);

    const sortColumn =
      typeof query.sortBy === "string" ? resource.sortColumns?.[query.sortBy] : undefined;
    if (sortColumn) {
      statement = statement.orderBy(
        query.sortOrder === "asc" ? asc(sortColumn) : desc(sortColumn)
      ) as typeof statement;
    } else if (columns.createdAt) {
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
    const totalItems = resource.listLoader
      ? ((await resource.listCountLoader?.({ userId, query })) ?? items.length)
      : await db
          .select({ value: count() })
          .from(resource.table)
          .where(conditions.length > 0 ? and(...conditions) : undefined)
          .then((rows) => rows[0]?.value ?? 0);
    return c.json(
      createSuccessResponse({ items, limit: query.limit, offset: query.offset, totalItems }),
      200
    );
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
    const denied = assertWriteAccess(resource, c, "create");
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

    const id = generateRandomId();
    const validationMessage = await resource.beforeCreate?.({ body, id, userId });
    if (validationMessage) {
      return c.json(
        createErrorResponse({ error: "Unprocessable Entity", message: validationMessage }),
        422
      );
    }

    const values: Record<string, unknown> = {
      ...(resource.transformCreateBody
        ? await resource.transformCreateBody({ body, id, userId })
        : body),
      id,
      createdByUser: userId,
    };
    if (resource.ownerKey) values[resource.ownerKey] = userId;

    try {
      const insertedRows = await db.insert(resource.table).values(values).returning();
      const insertedItem = (insertedRows as any[])[0];
      await resource.afterCreate?.({
        body,
        id: String(insertedItem.id),
        item: insertedItem,
        userId,
      });
      const item = resource.hydrateRecord
        ? await resource.hydrateRecord(String(insertedItem.id))
        : insertedItem;
      return c.json(createSuccessResponse(item), 201);
    } catch (error) {
      const mapped = resolveEcommerceDbError(error);
      if (mapped) {
        return c.json(
          createErrorResponse({
            error: mapped.status === 409 ? "Conflict" : "Unprocessable Entity",
            message: mapped.message,
          }),
          mapped.status
        );
      }
      throw error;
    }
  });

  registerOpenApiRoute(app, updateRoute, async (c: any) => {
    const denied = assertWriteAccess(resource, c, "update");
    if (denied) return denied;
    const userId = userIdFromContext(c);
    const { id } = c.req.valid("param");
    const body = c.req.valid("json") as Record<string, unknown>;
    if (resource.ownerKey) delete body[resource.ownerKey];

    if (!userId) throw new Error("Authenticated user context is missing.");
    const validationMessage = await resource.beforeUpdate?.({ body, id, userId });
    if (validationMessage) {
      return c.json(
        createErrorResponse({ error: "Unprocessable Entity", message: validationMessage }),
        422
      );
    }

    try {
      const updatedItem = await db
        .update(resource.table)
        .set({
          ...(resource.transformUpdateBody
            ? await resource.transformUpdateBody({ body, id, userId })
            : body),
          updatedByUser: userId,
        })
        .where(scopedWhere(resource, id, userId))
        .returning()
        .then((rows) => rows[0]);
      if (!updatedItem) {
        return c.json(
          createErrorResponse({ error: "Not Found", message: `${resource.name} not found.` }),
          404
        );
      }
      await resource.afterUpdate?.({
        body,
        id: String(updatedItem.id),
        item: updatedItem,
        userId,
      });
      const item = resource.hydrateRecord
        ? await resource.hydrateRecord(String(updatedItem.id))
        : updatedItem;
      return c.json(createSuccessResponse(item), 200);
    } catch (error) {
      const mapped = resolveEcommerceDbError(error);
      if (mapped) {
        return c.json(
          createErrorResponse({
            error: mapped.status === 409 ? "Conflict" : "Unprocessable Entity",
            message: mapped.message,
          }),
          mapped.status
        );
      }
      throw error;
    }
  });

  registerOpenApiRoute(app, deleteRoute, async (c: any) => {
    const denied = assertWriteAccess(resource, c, "delete");
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
    const denied = assertWriteAccess(resource, c, "restore");
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

  registerOpenApiRoute(app, permanentDeleteRoute, async (c: any) => {
    const denied = assertWriteAccess(resource, c, "permanentDelete");
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
      .delete(resource.table)
      .where(and(...conditions))
      .returning({ id: columns.id })
      .then((rows) => rows[0]);
    if (!item) {
      return c.json(
        createErrorResponse({
          error: "Not Found",
          message: `Deleted ${resource.name} record not found.`,
        }),
        404
      );
    }
    return c.json(createSuccessResponse({ id: item.id, permanentlyDeleted: true }), 200);
  });
}
