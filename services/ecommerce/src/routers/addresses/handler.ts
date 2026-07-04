import { OpenAPIHono } from "@hono/zod-openapi";
import { addresses, db, orders } from "@ikyomm/database";
import {
  createErrorResponse,
  createSuccessResponse,
  getBetterAuthContext,
  hasPermission,
  registerOpenApiRoute,
} from "@ikyomm/utils";
import { and, desc, eq, inArray } from "drizzle-orm";
import type { AppBindings } from "@/types/app";
import { addressesByOrderRoute, addressesByUserRoute } from "./openapi.route";
import { registerAddressResources } from "./utils";

export const addressesGroup = new OpenAPIHono<AppBindings>();

function canReadUserAddresses(c: Parameters<typeof getBetterAuthContext>[0], userId: string) {
  const auth = getBetterAuthContext(c);
  if (auth.user?.id === userId) return true;
  const role = auth.authorization.role?.trim().toLowerCase();
  const permission = auth.authorization.permissions?.treasure_addresses;
  return (
    role === "superadmin" ||
    (role === "admin" && !permission) ||
    hasPermission(auth, { resource: "treasure_addresses", action: "getAll" })
  );
}

registerOpenApiRoute(addressesGroup, addressesByUserRoute, async (c) => {
  const { userId } = c.req.valid("param");
  if (!canReadUserAddresses(c, userId)) {
    return c.json(
      createErrorResponse({
        error: "Forbidden",
        message: "You cannot access addresses for this user.",
      }),
      403
    );
  }
  const items = await db
    .select()
    .from(addresses)
    .where(and(eq(addresses.userId, userId), eq(addresses.isDeleted, false)))
    .orderBy(desc(addresses.isDefault), desc(addresses.updatedAt));
  return c.json(createSuccessResponse(items), 200);
});

registerOpenApiRoute(addressesGroup, addressesByOrderRoute, async (c) => {
  const { orderId } = c.req.valid("param");
  const order = await db.query.orders.findFirst({
    where: eq(orders.id, orderId),
  });
  if (!order || order.isDeleted) {
    return c.json(
      createErrorResponse({ error: "Not Found", message: "Order was not found." }),
      404
    );
  }
  if (!canReadUserAddresses(c, order.userId)) {
    return c.json(
      createErrorResponse({
        error: "Forbidden",
        message: "You cannot access addresses for this order.",
      }),
      403
    );
  }
  const addressIds = [order.billingAddressId, order.shippingAddressId].filter((id): id is string =>
    Boolean(id)
  );
  const orderAddresses =
    addressIds.length === 0
      ? []
      : await db.select().from(addresses).where(inArray(addresses.id, addressIds));
  const addressById = new Map(orderAddresses.map((address) => [address.id, address]));
  return c.json(
    createSuccessResponse({
      orderId: order.id,
      userId: order.userId,
      billing: {
        address: order.billingAddressId ? (addressById.get(order.billingAddressId) ?? null) : null,
        snapshot: order.billingAddressSnapshot,
      },
      shipping: {
        address: order.shippingAddressId
          ? (addressById.get(order.shippingAddressId) ?? null)
          : null,
        snapshot: order.shippingAddressSnapshot,
      },
    }),
    200
  );
});

registerAddressResources(addressesGroup);
