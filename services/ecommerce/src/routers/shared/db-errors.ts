/** Map Postgres unique / FK violations to clear API messages. */

const UNIQUE_CONSTRAINT_MESSAGES: Record<string, string> = {
  treasure_products_brand_slug_uidx:
    "A product with this slug already exists for the selected brand.",
  treasure_product_collections_slug_uidx: "A collection with this slug already exists.",
  treasure_product_collections_name_uidx: "A collection with this name already exists.",
  treasure_product_variants_sku_uidx: "A product variant with this SKU already exists.",
  treasure_brands_slug_uidx: "A brand with this slug already exists.",
  treasure_brands_name_uidx: "A brand with this name already exists.",
  treasure_categories_slug_uidx: "A category with this slug already exists.",
  treasure_subcategories_category_slug_uidx:
    "A subcategory with this slug already exists in the selected category.",
  treasure_warehouses_name_uidx: "A warehouse with this name already exists.",
};

const FOREIGN_KEY_MESSAGES: Record<string, string> = {
  treasure_products_brand_id_treasure_brands_id_fk: "Selected brand does not exist.",
  treasure_products_category_id_treasure_categories_id_fk: "Selected category does not exist.",
  treasure_products_subcategory_id_treasure_subcategories_id_fk:
    "Selected subcategory does not exist.",
  treasure_product_collection_products_collection_id_treasure_product_collections_id_fk:
    "One or more selected product collections do not exist.",
  treasure_product_collection_products_product_id_treasure_products_id_fk:
    "Selected product does not exist.",
  treasure_products_category_subcategory_fk:
    "Selected subcategory does not belong to the selected category.",
  treasure_product_variants_product_id_treasure_products_id_fk: "Selected product does not exist.",
};

type PgErrorLike = {
  code?: unknown;
  constraint?: unknown;
  constraint_name?: unknown;
  detail?: unknown;
  message?: unknown;
  cause?: unknown;
};

function asPgError(error: unknown): PgErrorLike | null {
  let current: unknown = error;
  while (current && typeof current === "object") {
    const record = current as PgErrorLike;
    if (typeof record.code === "string") {
      return record;
    }
    current = record.cause;
  }
  return null;
}

function readConstraint(error: PgErrorLike): string | undefined {
  if (typeof error.constraint === "string" && error.constraint.length > 0) {
    return error.constraint;
  }
  if (typeof error.constraint_name === "string" && error.constraint_name.length > 0) {
    return error.constraint_name;
  }
  return undefined;
}

export function resolveEcommerceDbError(error: unknown): {
  status: 409 | 422;
  message: string;
} | null {
  const pgError = asPgError(error);
  if (!pgError || typeof pgError.code !== "string") {
    return null;
  }

  const constraint = readConstraint(pgError);

  if (pgError.code === "23505") {
    if (constraint && UNIQUE_CONSTRAINT_MESSAGES[constraint]) {
      return { status: 409, message: UNIQUE_CONSTRAINT_MESSAGES[constraint] };
    }
    const detail = typeof pgError.detail === "string" ? pgError.detail.toLowerCase() : "";
    if (detail.includes("slug")) {
      return { status: 409, message: "This slug is already in use." };
    }
    if (detail.includes("name")) {
      return { status: 409, message: "This name is already in use." };
    }
    if (detail.includes("sku")) {
      return { status: 409, message: "This SKU is already in use." };
    }
    return { status: 409, message: "A record with these details already exists." };
  }

  if (pgError.code === "23503") {
    if (constraint && FOREIGN_KEY_MESSAGES[constraint]) {
      return { status: 422, message: FOREIGN_KEY_MESSAGES[constraint] };
    }
    return { status: 422, message: "One or more related records do not exist." };
  }

  return null;
}
