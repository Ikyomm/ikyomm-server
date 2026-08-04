/** biome-ignore-all lint/style/noNonNullAssertion: forced */
import {
  brands,
  categories,
  db,
  productCollectionProducts,
  productCollections,
  products,
  productVariants,
  subcategories,
} from "@ikyomm/database";
import { and, asc, count, desc, eq, exists, ilike, inArray, or, sql } from "drizzle-orm";
import type { z } from "zod";
import type { productListQuerySchema } from "./schema";

type ProductListQuery = z.output<typeof productListQuerySchema>;

type ProductRow = typeof products.$inferSelect;

function productConditions(input: ProductListQuery) {
  const conditions = [eq(products.isDeleted, input.isDeleted === true)];

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

  return conditions;
}

function productOrderBy(input: ProductListQuery) {
  const sortColumns = {
    name: products.name,
    slug: products.slug,
    createdAt: products.createdAt,
    updatedAt: products.updatedAt,
  } as const;
  const sortColumn =
    typeof input.sortBy === "string" ? sortColumns[input.sortBy as keyof typeof sortColumns] : null;

  return input.sortOrder === "asc"
    ? asc(sortColumn ?? products.createdAt)
    : desc(sortColumn ?? products.createdAt);
}

async function withProductCollections<TProduct extends ProductRow>(rows: TProduct[]) {
  if (rows.length === 0) {
    return [];
  }

  const productIds = rows.map((row) => row.id);
  const collectionRows = await db
    .select({
      productId: productCollectionProducts.productId,
      collection: {
        id: productCollections.id,
        name: productCollections.name,
        slug: productCollections.slug,
        description: productCollections.description,
        status: productCollections.status,
      },
    })
    .from(productCollectionProducts)
    .innerJoin(
      productCollections,
      eq(productCollectionProducts.collectionId, productCollections.id)
    )
    .where(
      and(
        inArray(productCollectionProducts.productId, productIds),
        eq(productCollections.isDeleted, false)
      )
    )
    .orderBy(asc(productCollections.name));

  const collectionsByProductId = new Map<string, (typeof collectionRows)[number]["collection"][]>();
  for (const row of collectionRows) {
    const collections = collectionsByProductId.get(row.productId) ?? [];
    collections.push(row.collection);
    collectionsByProductId.set(row.productId, collections);
  }

  return rows.map((row) => {
    const collections = collectionsByProductId.get(row.id) ?? [];
    return {
      ...row,
      collectionIds: collections.map((collection) => collection.id),
      collections,
    };
  });
}

export async function fetchProducts(input: ProductListQuery) {
  const conditions = productConditions(input);

  const rows = await db.query.products.findMany({
    where: and(...conditions),
    orderBy: [productOrderBy(input)],
    limit: input.limit,
    offset: input.offset,
  });
  return withProductCollections(rows);
}

export async function countProducts(input: ProductListQuery) {
  const conditions = productConditions(input);

  return db
    .select({ value: count() })
    .from(products)
    .where(and(...conditions))
    .then((rows) => rows[0]?.value ?? 0);
}

export async function findProduct(id: string) {
  const row = await db.query.products.findFirst({
    where: and(eq(products.id, id), eq(products.isDeleted, false)),
  });
  return row ? (await withProductCollections([row]))[0] : null;
}

export async function fetchProductFilterOptions() {
  const [brandRows, categoryRows, subcategoryRows, collectionRows, attributeRows] =
    await Promise.all([
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
          id: productCollections.id,
          name: productCollections.name,
          slug: productCollections.slug,
          description: productCollections.description,
          status: productCollections.status,
        })
        .from(productCollections)
        .where(
          and(eq(productCollections.isDeleted, false), eq(productCollections.status, "ACTIVE"))
        )
        .orderBy(asc(productCollections.name)),
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
    collections: collectionRows,
  };
}
