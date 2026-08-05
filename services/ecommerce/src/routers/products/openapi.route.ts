import { db, productCollections, products, productVariants } from "@ikyomm/database";
import { z } from "@hono/zod-openapi";
import { createApiSuccessResponse, createOpenApiRoute } from "@ikyomm/utils";
import type { CrudResourceConfig } from "../shared/crud";
import { ecommerceAuthMiddleware } from "../shared/auth";
import {
  productDetailsSchema,
  productFilterOptionsSchema,
  productListQuerySchema,
  productCollectionSchemas,
  productCreateSchema,
  productSchemas,
  productUpdateSchema,
  productVariantSkuAvailabilityQuerySchema,
  productVariantSkuAvailabilitySchema,
  productVariantSchemas,
  productWithImagesSchema,
} from "./schema";
import { countProducts, fetchProducts, findProduct } from "./list";
import { validateProductVariantSku } from "./sku";
import { and, eq } from "drizzle-orm";

function getCollectionId(body: Record<string, unknown>): string | null | undefined {
  if (!("collectionId" in body)) {
    return undefined;
  }
  const value = body.collectionId;
  if (value === null || value === "") {
    return null;
  }
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function validateProductCollection({ body }: { body: Record<string, unknown> }) {
  const collectionId = getCollectionId(body);
  if (collectionId === undefined || collectionId === null) {
    return null;
  }

  const row = await db
    .select({ id: productCollections.id })
    .from(productCollections)
    .where(and(eq(productCollections.id, collectionId), eq(productCollections.isDeleted, false)))
    .limit(1)
    .then((rows) => rows[0]);

  if (row) {
    return null;
  }

  return "Selected product collection does not exist.";
}

function productRowBody(body: Record<string, unknown>) {
  const collectionId = getCollectionId(body);
  const { collectionIds: _legacyIds, collection: _legacyText, ...rowBody } = body;
  if (collectionId === undefined) {
    const { collectionId: _omit, ...rest } = rowBody;
    return rest;
  }
  return { ...rowBody, collectionId };
}

export const productVariantSkuAvailabilityRoute = createOpenApiRoute({
  method: "get",
  path: "/product-variants/sku-availability",
  operationId: "productVariantSkuAvailability",
  tags: ["Product Variants"],
  middleware: [ecommerceAuthMiddleware],
  summary: "Check whether a product variant SKU is available",
  request: { query: productVariantSkuAvailabilityQuerySchema },
  responses: {
    200: createApiSuccessResponse(
      productVariantSkuAvailabilitySchema,
      "Product variant SKU checked successfully"
    ),
  },
});

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
    insertSchema: productCreateSchema,
    updateSchema: productUpdateSchema,
    publicRead: true,
    staffWrite: true,
    permissionResource: "treasure_products",
    listQuerySchema: productListQuerySchema,
    listLoader: ({ query }) => fetchProducts(productListQuerySchema.parse(query)),
    listCountLoader: ({ query }) => countProducts(productListQuerySchema.parse(query)),
    detailLoader: ({ id }) => findProduct(id),
    hydrateRecord: findProduct,
    beforeCreate: validateProductCollection,
    beforeUpdate: validateProductCollection,
    transformCreateBody: ({ body }) => {
      const row = productRowBody(body);
      // Create defaults missing collectionId to null.
      if (!("collectionId" in row)) {
        return { ...row, collectionId: null };
      }
      return row;
    },
    transformUpdateBody: ({ body }) => productRowBody(body),
  },
  {
    name: "product collections",
    path: "product-collections",
    tag: "Product Collections",
    table: productCollections,
    ...productCollectionSchemas,
    publicRead: true,
    staffWrite: true,
    permissionResource: "treasure_product_collections",
    searchColumns: [
      productCollections.name,
      productCollections.slug,
      productCollections.description,
    ],
    sortColumns: {
      name: productCollections.name,
      slug: productCollections.slug,
      createdAt: productCollections.createdAt,
      updatedAt: productCollections.updatedAt,
    },
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
    beforeCreate: validateProductVariantSku,
    beforeUpdate: validateProductVariantSku,
    searchColumns: [productVariants.sku, productVariants.name, productVariants.size],
    sortColumns: {
      name: productVariants.name,
      createdAt: productVariants.createdAt,
      updatedAt: productVariants.updatedAt,
    },
  },
];
