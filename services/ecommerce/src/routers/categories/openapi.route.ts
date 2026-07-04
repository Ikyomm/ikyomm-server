import { categories } from "@ikyomm/database";
import type { CrudResourceConfig } from "../shared/crud";
import { categorySchemas } from "./schema";

export const categoryResources: CrudResourceConfig[] = [
  {
    name: "categories",
    path: "categories",
    tag: "Categories",
    table: categories,
    ...categorySchemas,
    publicRead: true,
    staffWrite: true,
    permissionResource: "treasure_categories",
    searchColumns: [categories.name, categories.slug, categories.description],
    sortColumns: {
      name: categories.name,
      slug: categories.slug,
      createdAt: categories.createdAt,
      updatedAt: categories.updatedAt,
    },
  },
];
