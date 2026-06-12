/** biome-ignore-all lint/suspicious/noExplicitAny: forced */
import type { OpenAPIObjectConfigure } from "@hono/zod-openapi";

export const openApiInfo: OpenAPIObjectConfigure<any, any> = {
  openapi: "3.0.0",
  info: {
    title: "Company Service API",
    version: "1.0.0",
    description:
      "API for the Ommpods company service. This service manages company records and company-controlled member operations.",
  },
  tags: [
    {
      name: "Company",
      description:
        "Top-level company operations such as create, list, get, update, delete, restore, and settings.",
    },
    {
      name: "Company / Members",
      description: "Company member management endpoints grouped under the company domain.",
    },
  ],
  "x-tagGroups": [
    {
      name: "Company APIs",
      tags: ["Company", "Company / Members"],
    },
  ],
  servers: [
    {
      url: "/api/company",
      description: "Company API via Gateway",
    },
    {
      url: ".",
      description: "Company API (Direct Service)",
    },
  ],
};
