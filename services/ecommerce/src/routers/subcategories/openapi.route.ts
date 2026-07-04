import { subcategories } from "@ikyomm/database";
import type { CrudResourceConfig } from "../shared/crud";
import { subcategorySchemas } from "./schema";

export const subcategoryResources: CrudResourceConfig[] = [
  {
    name: "subcategories",
    path: "subcategories",
    tag: "Subcategories",
    table: subcategories,
    ...subcategorySchemas,
    publicRead: true,
    staffWrite: true,
    permissionResource: "treasure_subcategories",
    searchColumns: [subcategories.name, subcategories.slug, subcategories.description],
    sortColumns: {
      name: subcategories.name,
      slug: subcategories.slug,
      createdAt: subcategories.createdAt,
      updatedAt: subcategories.updatedAt,
    },
  },
];
