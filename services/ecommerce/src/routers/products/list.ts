import { brands, categories, db, products, productVariants, subcategories } from "@ikyomm/database";
import { and, asc, desc, eq, exists, ilike, or, sql } from "drizzle-orm";
import type { z } from "zod";
import type { productListQuerySchema } from "./schema";

type ProductListQuery = z.output<typeof productListQuerySchema>;

export function fetchProducts(input: ProductListQuery) {
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
    const attributeCondition =
      input.attributeName && input.attributeValue
        ? sql`${productVariants.attributes} ->> ${input.attributeName} = ${input.attributeValue}`
        : input.attributeName
          ? sql`${productVariants.attributes} ? ${input.attributeName}`
          : sql`exists (
              select 1
              from jsonb_each_text(${productVariants.attributes}) as attribute
              where attribute.value = ${input.attributeValue}
            )`;

    conditions.push(
      exists(
        db
          .select({ id: productVariants.id })
          .from(productVariants)
          .where(
            and(
              eq(productVariants.productId, products.id),
              eq(productVariants.isDeleted, false),
              attributeCondition
            )
          )
      )
    );
  }

  return db.query.products.findMany({
    where: and(...conditions),
    orderBy: [desc(products.createdAt)],
    limit: input.limit,
    offset: input.offset,
  });
}

export function findProduct(id: string) {
  return db.query.products.findFirst({
    where: and(eq(products.id, id), eq(products.isDeleted, false)),
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
    db.execute<{ name: string; value: string }>(sql`
      select distinct attribute.key as name, attribute.value
      from ${productVariants}
      cross join lateral jsonb_each_text(${productVariants.attributes}) as attribute
      where ${productVariants.isDeleted} = false
      order by attribute.key, attribute.value
    `),
  ]);

  const attributeMap = new Map<string, string[]>();
  for (const attribute of attributeRows.rows) {
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
