import { brands } from "@ikyomm/database";
import { z } from "@hono/zod-openapi";
import { createApiJsonBody, createApiSuccessResponse, createOpenApiRoute } from "@ikyomm/utils";
import type { CrudResourceConfig } from "../shared/crud";
import {
  brandCategoryAssignmentResultSchema,
  brandCategoryAssignmentSchema,
  brandSchemas,
} from "./schema";

export const assignBrandCategoriesRoute = createOpenApiRoute({
  method: "put",
  path: "/brands/{id}/categories",
  operationId: "brandAssignCategories",
  tags: ["Brands"],
  summary: "Assign categories to a brand",
  request: {
    params: z.object({ id: z.string().min(1) }),
    body: createApiJsonBody(brandCategoryAssignmentSchema),
  },
  responses: {
    200: createApiSuccessResponse(
      brandCategoryAssignmentResultSchema,
      "Brand categories assigned successfully"
    ),
  },
});

export const brandResources: CrudResourceConfig[] = [
  {
    name: "brands",
    path: "brands",
    tag: "Brands",
    table: brands,
    ...brandSchemas,
    publicRead: true,
    staffWrite: true,
    permissionResource: "treasure_brands",
    searchColumns: [brands.name, brands.slug, brands.tagline],
    sortColumns: {
      name: brands.name,
      slug: brands.slug,
      createdAt: brands.createdAt,
      updatedAt: brands.updatedAt,
    },
  },
];
