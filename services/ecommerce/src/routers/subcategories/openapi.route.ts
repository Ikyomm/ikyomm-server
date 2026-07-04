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
  },
];
