import { OpenAPIHono } from "@hono/zod-openapi";
import { brands, categories, db } from "@ikyomm/database";
import {
  createErrorResponse,
  createSuccessResponse,
  getBetterAuthContext,
  hasPermission,
  registerOpenApiRoute,
} from "@ikyomm/utils";
import { and, eq, inArray, notInArray } from "drizzle-orm";
import type { AppBindings } from "@/types/app";
import { ecommerceAuthMiddleware } from "../shared/auth";
import { assignBrandCategoriesRoute } from "./openapi.route";
import { registerBrandResources } from "./utils";

export const brandsGroup = new OpenAPIHono<AppBindings>();
brandsGroup.use("/brands/:id/categories", ecommerceAuthMiddleware);

registerOpenApiRoute(brandsGroup, assignBrandCategoriesRoute, async (c) => {
  const auth = getBetterAuthContext(c);
  const role = auth.authorization.role?.trim().toLowerCase();
  const permission = auth.authorization.permissions?.treasure_brands;
  const allowed =
    role === "superadmin" ||
    (role === "admin" && !permission) ||
    hasPermission(auth, { resource: "treasure_brands", action: "update" });
  if (!allowed) {
    return c.json(
      createErrorResponse({
        error: "Forbidden",
        message: "Missing permission: treasure_brands.update",
      }),
      403
    );
  }

  const { id } = c.req.valid("param");
  const { categoryIds } = c.req.valid("json");
  const uniqueCategoryIds = [...new Set(categoryIds)];
  const brand = await db.query.brands.findFirst({
    where: and(eq(brands.id, id), eq(brands.isDeleted, false)),
  });
  if (!brand) {
    return c.json(
      createErrorResponse({ error: "Not Found", message: "Brand was not found." }),
      404
    );
  }

  const availableCategories =
    uniqueCategoryIds.length === 0
      ? []
      : await db
          .select({ id: categories.id })
          .from(categories)
          .where(and(inArray(categories.id, uniqueCategoryIds), eq(categories.isDeleted, false)));
  if (availableCategories.length !== uniqueCategoryIds.length) {
    return c.json(
      createErrorResponse({
        error: "Unprocessable Entity",
        message: "One or more selected categories are unavailable.",
      }),
      422
    );
  }

  const userId = auth.user?.id ?? null;
  await db.transaction(async (tx) => {
    const unassignWhere =
      uniqueCategoryIds.length === 0
        ? eq(categories.brandId, id)
        : and(eq(categories.brandId, id), notInArray(categories.id, uniqueCategoryIds));
    await tx.update(categories).set({ brandId: null, updatedByUser: userId }).where(unassignWhere);
    if (uniqueCategoryIds.length > 0) {
      await tx
        .update(categories)
        .set({ brandId: id, updatedByUser: userId })
        .where(inArray(categories.id, uniqueCategoryIds));
    }
  });

  return c.json(createSuccessResponse({ brandId: id, categoryIds: uniqueCategoryIds }), 200);
});

registerBrandResources(brandsGroup);
