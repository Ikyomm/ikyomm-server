import { OpenAPIHono } from "@hono/zod-openapi";
import { createErrorResponse, createSuccessResponse, registerOpenApiRoute } from "@ikyomm/utils";
import type { AppBindings } from "@/types/app";
import { productDetailsRoute, productFilterOptionsRoute } from "./openapi.route";
import { fetchProductFilterOptions } from "./list";
import { findProductDetails, registerProductResources } from "./utils";

export const productsGroup = new OpenAPIHono<AppBindings>();

registerOpenApiRoute(productsGroup, productFilterOptionsRoute, async (c) =>
  c.json(createSuccessResponse(await fetchProductFilterOptions()), 200)
);

registerProductResources(productsGroup);

registerOpenApiRoute(productsGroup, productDetailsRoute, async (c) => {
  const product = await findProductDetails(c.req.valid("param").id);
  if (!product) {
    return c.json(
      createErrorResponse({ error: "Not Found", message: "Product was not found." }),
      404
    );
  }
  return c.json(createSuccessResponse(product), 200);
});
