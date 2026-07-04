import { products, productVariants } from "@ikyomm/database";
import { z } from "@hono/zod-openapi";
import { createApiSuccessResponse, createOpenApiRoute } from "@ikyomm/utils";
import type { CrudResourceConfig } from "../shared/crud";
import {
  productDetailsSchema,
  productFilterOptionsSchema,
  productListQuerySchema,
  productSchemas,
  productVariantSchemas,
  productWithImagesSchema,
} from "./schema";
import { fetchProducts, findProduct } from "./list";

export const productFilterOptionsRoute = createOpenApiRoute({
  method: "get",
  path: "/products/filter-options",
  operationId: "productFilterOptions",
  tags: ["Products"],
  summary: "Get product filter options for brands, categories, subcategories, and attributes",
  responses: {
    200: createApiSuccessResponse(
      productFilterOptionsSchema,
      "Product filter options fetched successfully"
    ),
  },
});

export const productDetailsRoute = createOpenApiRoute({
  method: "get",
  path: "/products/{id}/details",
  operationId: "productGetDetailsById",
  tags: ["Products"],
  summary: "Get a product with brand, category, subcategory, variants, and embedded images",
  request: { params: z.object({ id: z.string().min(1) }) },
  responses: {
    200: createApiSuccessResponse(productDetailsSchema, "Product details fetched successfully"),
  },
});

export const productResources: CrudResourceConfig[] = [
  {
    name: "products",
    path: "products",
    tag: "Products",
    table: products,
    ...productSchemas,
    selectSchema: productWithImagesSchema,
    publicRead: true,
    staffWrite: true,
    permissionResource: "treasure_products",
    listQuerySchema: productListQuerySchema,
    listLoader: ({ query }) => fetchProducts(productListQuerySchema.parse(query)),
    detailLoader: ({ id }) => findProduct(id),
    hydrateRecord: findProduct,
  },
  {
    name: "product variants",
    path: "product-variants",
    tag: "Product Variants",
    table: productVariants,
    ...productVariantSchemas,
    publicRead: true,
    staffWrite: true,
    permissionResource: "treasure_product_variants",
    searchColumns: [productVariants.sku, productVariants.name, productVariants.size],
    sortColumns: {
      name: productVariants.name,
      createdAt: productVariants.createdAt,
      updatedAt: productVariants.updatedAt,
    },
  },
];
