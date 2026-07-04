import { addresses } from "@ikyomm/database";
import { z } from "@hono/zod-openapi";
import { createApiSuccessResponse, createOpenApiRoute } from "@ikyomm/utils";
import type { CrudResourceConfig } from "../shared/crud";
import { ecommerceAuthMiddleware } from "../shared/auth";
import { addressSchemas, orderAddressesResultSchema } from "./schema";

export const addressesByUserRoute = createOpenApiRoute({
  method: "get",
  path: "/user/{userId}",
  operationId: "addressesGetByUserId",
  tags: ["Addresses"],
  middleware: [ecommerceAuthMiddleware],
  summary: "Get active addresses by user ID",
  request: { params: z.object({ userId: z.string().min(1) }) },
  responses: {
    200: createApiSuccessResponse(
      z.array(addressSchemas.selectSchema),
      "User addresses fetched successfully"
    ),
  },
});

export const addressesByOrderRoute = createOpenApiRoute({
  method: "get",
  path: "/order/{orderId}",
  operationId: "addressesGetByOrderId",
  tags: ["Addresses"],
  middleware: [ecommerceAuthMiddleware],
  summary: "Get billing and shipping addresses by order ID",
  request: { params: z.object({ orderId: z.string().min(1) }) },
  responses: {
    200: createApiSuccessResponse(
      orderAddressesResultSchema,
      "Order addresses fetched successfully"
    ),
  },
});

export const addressResources: CrudResourceConfig[] = [
  {
    name: "addresses",
    path: "",
    tag: "Addresses",
    table: addresses,
    ...addressSchemas,
    ownerColumn: addresses.userId,
    ownerKey: "userId",
  },
];
