/** biome-ignore-all lint/suspicious/noExplicitAny: forced */
import type { OpenAPIObjectConfigure } from "@hono/zod-openapi";

export const openApiInfo: OpenAPIObjectConfigure<any, any> = {
  openapi: "3.0.0",
  info: {
    title: "Ommpods Session Service API",
    version: "1.0.0",
    description: "Live pod session APIs for bookings, mood/aroma controls, and hardware polling.",
  },
  tags: [
    { name: "Sessions", description: "Pod session booking endpoints." },
    { name: "Control", description: "Active session mood and aroma control endpoints." },
    { name: "Polling", description: "Public hardware polling endpoints." },
  ],
  "x-tagGroups": [
    {
      name: "Ommpods Live APIs",
      tags: ["Sessions", "Control", "Polling"],
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
