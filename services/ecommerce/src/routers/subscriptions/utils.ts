import { db, products, productVariants } from "@ikyomm/database";
import { eq } from "drizzle-orm";

export async function validateSubscriptionProduct(body: Record<string, unknown>) {
  if (typeof body.variantId !== "string") return "A valid variantId is required.";

  const variant = await db
    .select({ isSubscriptionEligible: products.isSubscriptionEligible })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(eq(productVariants.id, body.variantId))
    .limit(1)
    .then((rows) => rows[0]);

  if (!variant) return "Product variant was not found.";
  if (!variant.isSubscriptionEligible) return "This product is not subscription eligible.";
  return null;
}
