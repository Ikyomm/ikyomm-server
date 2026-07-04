import { brands } from "@ikyomm/database";
import type { CrudResourceConfig } from "../shared/crud";
import { brandSchemas } from "./schema";

export const brandResources: CrudResourceConfig[] = [
  {
    name: "brands",
    path: "brands",
    tag: "Brands",
    table: brands,
    ...brandSchemas,
    publicRead: true,
    staffWrite: true,
  },
];
