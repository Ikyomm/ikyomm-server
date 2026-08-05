import {
  db,
  productCollectionProducts,
  productCollections,
  products,
  productVariants,
} from "@ikyomm/database";
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
import { and, eq, inArray } from "drizzle-orm";

function getCollectionIds(body: Record<string, unknown>): string[] | null {
  if (!("collectionIds" in body)) {
    return null;
  }
  if (!Array.isArray(body.collectionIds)) {
    return null;
  }

  return [
    ...new Set(
      body.collectionIds
        .filter((id): id is string => typeof id === "string")
        .map((id) => id.trim())
        .filter((id) => id.length > 0)
    ),
  ];
}

function productRowBody(body: Record<string, unknown>) {
  const {
    collectionIds: _collectionIds,
    collectionId: _collectionId,
    collection: _collection,
    ...rowBody
  } = body;
  return rowBody;
}

async function validateProductCollections({ body }: { body: Record<string, unknown> }) {
  const collectionIds = getCollectionIds(body);
  if (!collectionIds || collectionIds.length === 0) {
    return null;
  }

  const rows = await db
    .select({ id: productCollections.id })
    .from(productCollections)
    .where(
      and(inArray(productCollections.id, collectionIds), eq(productCollections.isDeleted, false))
    );
  if (rows.length === collectionIds.length) {
    return null;
  }

  return "One or more selected product collections do not exist.";
}

async function syncProductCollections({
  body,
  id,
  userId,
}: {
  body: Record<string, unknown>;
  id: string;
  userId: string;
}) {
  const collectionIds = getCollectionIds(body);
  if (!collectionIds) {
    return;
  }

  await db.delete(productCollectionProducts).where(eq(productCollectionProducts.productId, id));

  if (collectionIds.length > 0) {
    await db.insert(productCollectionProducts).values(
      collectionIds.map((collectionId) => ({
        productId: id,
        collectionId,
        createdByUser: userId,
      }))
    );
  }
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
    beforeCreate: validateProductCollections,
    beforeUpdate: validateProductCollections,
    transformCreateBody: ({ body }) => productRowBody(body),
    transformUpdateBody: ({ body }) => productRowBody(body),
    afterCreate: syncProductCollections,
    afterUpdate: syncProductCollections,
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
