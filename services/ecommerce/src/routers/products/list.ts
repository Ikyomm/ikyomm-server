import {
  brands,
  categories,
  db,
  productImages,
  products,
  productVariants,
  subcategories,
  variantAttributes,
} from "@ikyomm/database";
import { and, asc, desc, eq, exists, ilike, or } from "drizzle-orm";
import type { z } from "zod";
import type { productListQuerySchema } from "./schema";

const productWithImages = {
  images: {
    where: eq(productImages.isDeleted, false),
    orderBy: [asc(productImages.sortOrder)],
  },
} as const;

type ProductListQuery = z.output<typeof productListQuerySchema>;

export function fetchProductsWithImages(input: ProductListQuery) {
  const conditions = [eq(products.isDeleted, false)];

  if (input.search) {
    conditions.push(
      or(ilike(products.name, `%${input.search}%`), ilike(products.slug, `%${input.search}%`))!
    );
  }
  if (input.brandId) conditions.push(eq(products.brandId, input.brandId));
  if (input.categoryId) conditions.push(eq(products.categoryId, input.categoryId));
  if (input.subcategoryId) conditions.push(eq(products.subcategoryId, input.subcategoryId));
  if (input.productType) conditions.push(eq(products.productType, input.productType));
  if (input.status) conditions.push(eq(products.status, input.status));
  if (input.isSubscriptionEligible !== undefined) {
    conditions.push(eq(products.isSubscriptionEligible, input.isSubscriptionEligible));
  }
  if (input.isHeroProduct !== undefined) {
    conditions.push(eq(products.isHeroProduct, input.isHeroProduct));
  }
  if (input.attributeName || input.attributeValue) {
    conditions.push(
      exists(
        db
          .select({ id: variantAttributes.id })
          .from(productVariants)
          .innerJoin(variantAttributes, eq(variantAttributes.variantId, productVariants.id))
          .where(
            and(
              eq(productVariants.productId, products.id),
              eq(productVariants.isDeleted, false),
              eq(variantAttributes.isDeleted, false),
              input.attributeName
                ? eq(variantAttributes.attributeName, input.attributeName)
                : undefined,
              input.attributeValue
                ? eq(variantAttributes.attributeValue, input.attributeValue)
                : undefined
            )
          )
      )
    );
  }

  return db.query.products.findMany({
    where: and(...conditions),
    with: productWithImages,
    orderBy: [desc(products.createdAt)],
    limit: input.limit,
    offset: input.offset,
  });
}

export function findProductWithImages(id: string) {
  return db.query.products.findFirst({
    where: and(eq(products.id, id), eq(products.isDeleted, false)),
    with: productWithImages,
  });
}

export async function fetchProductFilterOptions() {
  const [brandRows, categoryRows, subcategoryRows, attributeRows] = await Promise.all([
    db
      .select({ id: brands.id, name: brands.name, slug: brands.slug })
      .from(brands)
      .where(and(eq(brands.isDeleted, false), eq(brands.status, "ACTIVE")))
      .orderBy(asc(brands.name)),
    db
      .select({ id: categories.id, name: categories.name, slug: categories.slug })
      .from(categories)
      .where(and(eq(categories.isDeleted, false), eq(categories.status, "ACTIVE")))
      .orderBy(asc(categories.name)),
    db
      .select({
        id: subcategories.id,
        categoryId: subcategories.categoryId,
        name: subcategories.name,
        slug: subcategories.slug,
      })
      .from(subcategories)
      .where(and(eq(subcategories.isDeleted, false), eq(subcategories.status, "ACTIVE")))
      .orderBy(asc(subcategories.name)),
    db
      .select({
        name: variantAttributes.attributeName,
        value: variantAttributes.attributeValue,
      })
      .from(variantAttributes)
      .where(eq(variantAttributes.isDeleted, false))
      .groupBy(variantAttributes.attributeName, variantAttributes.attributeValue)
      .orderBy(asc(variantAttributes.attributeName), asc(variantAttributes.attributeValue)),
  ]);

  const attributeMap = new Map<string, string[]>();
  for (const attribute of attributeRows) {
    const values = attributeMap.get(attribute.name) ?? [];
    values.push(attribute.value);
    attributeMap.set(attribute.name, values);
  }

  return {
    brands: brandRows,
    categories: categoryRows.map((category) => ({
      ...category,
      subcategories: subcategoryRows.filter(
        (subcategory) => subcategory.categoryId === category.id
      ),
    })),
    attributes: [...attributeMap].map(([name, values]) => ({ name, values })),
    productTypes: ["SIMPLE", "VARIABLE", "BUNDLE", "SUBSCRIPTION"] as const,
    statuses: ["PLANNED", "DRAFT", "ACTIVE", "INACTIVE", "OUT_OF_STOCK"] as const,
  };
}
