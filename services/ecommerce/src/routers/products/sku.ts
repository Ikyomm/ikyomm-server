import { db, productVariants } from "@ikyomm/database";
import { and, ne, sql } from "drizzle-orm";

export const normalizeProductVariantSku = (sku: string) => sku.trim().toUpperCase();

export async function isProductVariantSkuAvailable(sku: string, excludeId?: string) {
  const normalizedSku = normalizeProductVariantSku(sku);
  const conditions = [sql`upper(${productVariants.sku}) = ${normalizedSku}`];
  if (excludeId) conditions.push(ne(productVariants.id, excludeId));

  const existing = await db
    .select({ id: productVariants.id })
    .from(productVariants)
    .where(and(...conditions))
    .limit(1)
    .then((rows) => rows[0]);

  return !existing;
}

export async function validateProductVariantSku({
  body,
  id,
}: {
  body: Record<string, unknown>;
  id?: string;
}) {
  if (typeof body.sku !== "string") return null;

  const normalizedSku = normalizeProductVariantSku(body.sku);
  body.sku = normalizedSku;
  return (await isProductVariantSkuAvailable(normalizedSku, id))
    ? null
    : "This SKU is already assigned to another product variant.";
}
