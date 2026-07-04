/** biome-ignore-all lint/suspicious/noExplicitAny: OpenAPI configure type requires generic parameters. */
import type { OpenAPIObjectConfigure } from "@hono/zod-openapi";

export const openApiInfo: OpenAPIObjectConfigure<any, any> = {
  openapi: "3.0.0",
  info: {
    title: "IKYOMM Ecommerce Service API",
    version: "1.0.0",
    description:
      "Ecommerce APIs for brands, categories, subcategories, products, variants, images, inventory, orders, addresses, subscriptions, payments, and reviews.",
  },
  tags: [
    { name: "Brands", description: "Brand management." },
    { name: "Categories", description: "Top-level product category management." },
    { name: "Subcategories", description: "Subcategories associated with product categories." },
    { name: "Products", description: "Product management and complete product details." },
    { name: "Product Variants", description: "SKU and product variant management." },
    { name: "Product Images", description: "Product image references and ordering." },
    { name: "Variant Attributes", description: "Variant-specific attribute management." },
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
