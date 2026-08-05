/** biome-ignore-all lint/suspicious/noExplicitAny: forced */
import type { OpenAPIObjectConfigure } from "@hono/zod-openapi";

export const openApiInfo: OpenAPIObjectConfigure<any, any> = {
  openapi: "3.0.0",
  info: {
    title: "Kernel Service API",
    version: "1.0.0",
    description:
      "API for the Ommpods kernel service. This service manages company records and company-member operations for the Ommpods platform.",
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
    {
      name: "Ommpods / Roles & Permissions",
      description: "Ommpods platform role and permission management endpoints.",
    },
    {
      name: "Ommpods / Users",
      description: "Ommpods platform user management endpoints.",
    },
    {
      name: "Records / Pods",
      description: "CRUD endpoints for Pods records.",
    },
    {
      name: "Records / Aroma Defusers",
      description: "CRUD endpoints for Aroma Defuser device records.",
    },
    {
      name: "Records / Mood Presets",
      description: "CRUD endpoints for Pod mood preset configuration records.",
    },
    {
      name: "Records / Music Playlists",
      description:
        "CRUD endpoints for music playlist master records used by mood presets and the website.",
    },
    {
      name: "Records / Musics",
      description:
        "CRUD endpoints for music track master records belonging to playlists, for website and device playback.",
    },
  ],
  "x-tagGroups": [
    {
      name: "Company APIs",
      tags: ["Company", "Company / Members"],
    },
    {
      name: "Ommpods APIs",
      tags: ["Ommpods / Roles & Permissions", "Ommpods / Users"],
    },
    {
      name: "Records APIs",
      tags: [
        "Records / Pods",
        "Records / Aroma Defusers",
        "Records / Mood Presets",
        "Records / Music Playlists",
        "Records / Musics",
      ],
    },
  ],
  servers: [
    {
      url: "/api/kernel",
      description: "Kernel API via Gateway",
    },
    {
      url: ".",
      description: "Kernel API (Direct Service)",
    },
  ],
};
