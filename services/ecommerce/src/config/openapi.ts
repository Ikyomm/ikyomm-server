/** biome-ignore-all lint/suspicious/noExplicitAny: OpenAPI configure type requires generic parameters. */
import type { OpenAPIObjectConfigure } from "@hono/zod-openapi";

export const openApiInfo: OpenAPIObjectConfigure<any, any> = {
  openapi: "3.0.0",
  info: {
    title: "IKYOMM Ecommerce Service API",
    version: "1.0.0",
    description:
      "Ecommerce APIs for brands, categories, subcategories, products, variants, inventory, orders, addresses, subscriptions, payments, and reviews. Product images and variant attributes are embedded on product/variant payloads (no separate endpoints).",
  },
  tags: [
    { name: "Brands", description: "Brand management." },
    { name: "Categories", description: "Top-level product category management." },
    { name: "Subcategories", description: "Subcategories associated with product categories." },
    {
      name: "Products",
      description:
        "Product management and details. Images are stored on the product payload as an `images` array.",
    },
    {
      name: "Product Variants",
      description:
        "SKU and product variant management. Attributes are stored on the variant payload as an `attributes` object.",
    },
    { name: "Product Collections", description: "Product collection master records." },
    { name: "Inventory", description: "Warehouses and product variant stock management." },
    { name: "Orders", description: "Orders, order items, and payments." },
    { name: "Addresses", description: "Authenticated user billing and shipping addresses." },
    { name: "Subscriptions", description: "Authenticated recurring product subscriptions." },
    { name: "Reviews", description: "Authenticated product reviews." },
  ],
  servers: [
    { url: "/api/ecommerce", description: "Ecommerce API via Gateway" },
    { url: ".", description: "Ecommerce API (direct service on port 6008)" },
  ],
};
