import type { OpenAPIHono } from "@hono/zod-openapi";
import {
  db,
  productCollectionProducts,
  productCollections,
  products,
  productVariants,
} from "@ikyomm/database";
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

  const collectionRows = await db
    .select({
      id: productCollections.id,
      name: productCollections.name,
      slug: productCollections.slug,
      description: productCollections.description,
      status: productCollections.status,
    })
    .from(productCollectionProducts)
    .innerJoin(
      productCollections,
      eq(productCollectionProducts.collectionId, productCollections.id)
    )
    .where(
      and(
        eq(productCollectionProducts.productId, product.id),
        eq(productCollections.isDeleted, false)
      )
    )
    .orderBy(asc(productCollections.name));

  return {
    ...product,
    collectionIds: collectionRows.map((collection) => collection.id),
    collections: collectionRows,
  };
}
