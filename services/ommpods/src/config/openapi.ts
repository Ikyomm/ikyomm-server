/** biome-ignore-all lint/suspicious/noExplicitAny: forced */
import type { OpenAPIObjectConfigure } from "@hono/zod-openapi";

export const openApiInfo: OpenAPIObjectConfigure<any, any> = {
  openapi: "3.0.0",
  info: {
    title: "Ommpods Session Service API",
    version: "1.0.0",
    description: "Live pod session APIs for bookings and mood/aroma controls.",
  },
  tags: [
    { name: "Sessions", description: "Pod session booking endpoints." },
    { name: "Control", description: "Active session mood and aroma control endpoints." },
  ],
  "x-tagGroups": [
    {
      name: "Ommpods Live APIs",
      tags: ["Sessions", "Control"],
    },
  ],
  servers: [
    {
      url: "/api/ommpods",
      description: "Ommpods API via Gateway",
    },
    {
      url: ".",
      description: "Ommpods API (Direct Service)",
    },
  ],
};
