import { addresses, db } from "@ikyomm/database";
import { and, eq, inArray } from "drizzle-orm";

export async function validateOrderAddresses(body: Record<string, unknown>, userId: string) {
  const addressIds = [body.billingAddressId, body.shippingAddressId].filter(
    (value): value is string => typeof value === "string"
  );
  if (addressIds.length === 0) return null;

  const ownedAddresses = await db
    .select({ id: addresses.id })
    .from(addresses)
    .where(
      and(
        eq(addresses.userId, userId),
        eq(addresses.isDeleted, false),
        inArray(addresses.id, addressIds)
      )
    );

  return new Set(ownedAddresses.map((address) => address.id)).size === new Set(addressIds).size
    ? null
    : "Billing and shipping addresses must belong to the authenticated user.";
}
