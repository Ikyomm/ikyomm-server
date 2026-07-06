import { brands, categories, products, productVariants, subcategories } from "@ikyomm/database";
import { z } from "@hono/zod-openapi";
import { createDbInsertSchema, createDbSelectSchema, createDbUpdateSchema } from "@ikyomm/utils";

const omit = [
  "id",
  "createdAt",
  "updatedAt",
  "deletedAt",
  "isDeleted",
  "createdByUser",
  "updatedByUser",
  "deletedByUser",
] as const;

export const brandSelectSchema = createDbSelectSchema(brands);
export const categorySelectSchema = createDbSelectSchema(categories);
export const subcategorySelectSchema = createDbSelectSchema(subcategories);

export const productSchemas = {
  selectSchema: createDbSelectSchema(products),
  insertSchema: createDbInsertSchema(products, { omit }),
  updateSchema: createDbUpdateSchema(products, { omit }),
};
export const productVariantSchemas = {
  selectSchema: createDbSelectSchema(productVariants),
  insertSchema: createDbInsertSchema(productVariants, { omit }),
  updateSchema: createDbUpdateSchema(productVariants, { omit }),
};
export const productVariantSkuAvailabilityQuerySchema = z.object({
  sku: z.string().trim().min(4).max(100),
  excludeId: z.string().trim().min(1).optional(),
});
export const productVariantSkuAvailabilitySchema = z.object({
  sku: z.string(),
  available: z.boolean(),
});
export const productWithImagesSchema = productSchemas.selectSchema;

const optionalBooleanQuerySchema = z
  .union([z.boolean(), z.enum(["true", "false"]).transform((value) => value === "true")])
  .optional();

export const productListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
  search: z.string().trim().min(1).optional(),
  brandId: z.string().trim().min(1).optional(),
  categoryId: z.string().trim().min(1).optional(),
  subcategoryId: z.string().trim().min(1).optional(),
  productType: z.enum(["SIMPLE", "VARIABLE", "BUNDLE", "SUBSCRIPTION"]).optional(),
  status: z.enum(["PLANNED", "DRAFT", "ACTIVE", "INACTIVE", "OUT_OF_STOCK"]).optional(),
  isSubscriptionEligible: optionalBooleanQuerySchema,
  isHeroProduct: optionalBooleanQuerySchema,
  attributeName: z.string().trim().min(1).optional(),
  attributeValue: z.string().trim().min(1).optional(),
});

export const productFilterOptionsSchema = z.object({
  brands: z.array(brandSelectSchema.pick({ id: true, name: true, slug: true })),
  categories: z.array(
    categorySelectSchema.pick({ id: true, name: true, slug: true }).extend({
      subcategories: z.array(
        subcategorySelectSchema.pick({ id: true, categoryId: true, name: true, slug: true })
      ),
    })
  ),
  attributes: z.array(
    z.object({
      name: z.string(),
      values: z.array(z.string()),
    })
  ),
  productTypes: z.array(z.enum(["SIMPLE", "VARIABLE", "BUNDLE", "SUBSCRIPTION"])),
  statuses: z.array(z.enum(["PLANNED", "DRAFT", "ACTIVE", "INACTIVE", "OUT_OF_STOCK"])),
});

export const productDetailsSchema = productWithImagesSchema.extend({
  brand: brandSelectSchema,
  category: categorySelectSchema,
  subcategory: subcategorySelectSchema,
  variants: z.array(productVariantSchemas.selectSchema),
});
