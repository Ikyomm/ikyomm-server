import { productImages, products, productVariants, variantAttributes } from "@ikyomm/database";
import { z } from "@hono/zod-openapi";
import { createApiSuccessResponse, createOpenApiRoute } from "@ikyomm/utils";
import type { CrudResourceConfig } from "../shared/crud";
import {
  productDetailsSchema,
  productImageSchemas,
  productFilterOptionsSchema,
  productListQuerySchema,
  productSchemas,
  productVariantSchemas,
  productWithImagesSchema,
  variantAttributeSchemas,
} from "./schema";
import { fetchProductsWithImages, findProductWithImages } from "./list";

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
  summary: "Get a product with brand, category, subcategory, variants, attributes, and images",
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
    listQuerySchema: productListQuerySchema,
    listLoader: ({ query }) => fetchProductsWithImages(productListQuerySchema.parse(query)),
    detailLoader: ({ id }) => findProductWithImages(id),
    hydrateRecord: findProductWithImages,
  },
  {
    name: "product variants",
    path: "product-variants",
    tag: "Product Variants",
    table: productVariants,
    ...productVariantSchemas,
    publicRead: true,
    staffWrite: true,
  },
  {
    name: "product images",
    path: "product-images",
    tag: "Product Images",
    table: productImages,
    ...productImageSchemas,
    publicRead: true,
    staffWrite: true,
  },
  {
    name: "variant attributes",
    path: "variant-attributes",
    tag: "Variant Attributes",
    table: variantAttributes,
    ...variantAttributeSchemas,
    publicRead: true,
    staffWrite: true,
  },
];
