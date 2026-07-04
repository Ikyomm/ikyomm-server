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
  },
];
