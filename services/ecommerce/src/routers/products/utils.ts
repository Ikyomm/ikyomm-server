import type { OpenAPIHono } from "@hono/zod-openapi";
import { db, products, productVariants } from "@ikyomm/database";
import { and, eq } from "drizzle-orm";
import type { AppBindings } from "@/types/app";
import { registerCrudResource } from "../shared/crud";
import { productResources } from "./openapi.route";

export function registerProductResources(app: OpenAPIHono<AppBindings>) {
  for (const resource of productResources) registerCrudResource(app, resource);
}

export function findProductDetails(id: string) {
  return db.query.products.findFirst({
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
}
