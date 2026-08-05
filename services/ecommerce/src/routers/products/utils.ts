import type { OpenAPIHono } from "@hono/zod-openapi";
import { db, productCollections, products, productVariants } from "@ikyomm/database";
import { and, asc, eq } from "drizzle-orm";
import type { AppBindings } from "@/types/app";
import { registerCrudResource } from "../shared/crud";
import { productResources } from "./openapi.route";

export function registerProductResources(app: OpenAPIHono<AppBindings>) {
  for (const resource of productResources) registerCrudResource(app, resource);
}

export async function findProductDetails(id: string) {
  const product = await db.query.products.findFirst({
    where: and(eq(products.id, id), eq(products.isDeleted, false)),
    with: {
      brand: true,
      category: true,
      subcategory: true,
      variants: {
        where: eq(productVariants.isDeleted, false),
      },
    },
  });

  if (!product) {
    return null;
  }

  const collection = product.collectionId
    ? await db
        .select({
          id: productCollections.id,
          name: productCollections.name,
          slug: productCollections.slug,
          description: productCollections.description,
          status: productCollections.status,
        })
        .from(productCollections)
        .where(
          and(
            eq(productCollections.id, product.collectionId),
            eq(productCollections.isDeleted, false)
          )
        )
        .limit(1)
        .then((rows) => rows[0] ?? null)
    : null;

  return {
    ...product,
    collectionId: product.collectionId ?? null,
    collections: collection ? [collection] : [],
  };
}
