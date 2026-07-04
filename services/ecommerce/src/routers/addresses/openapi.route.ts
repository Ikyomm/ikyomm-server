import { addresses } from "@ikyomm/database";
import type { CrudResourceConfig } from "../shared/crud";
import { addressSchemas } from "./schema";

export const addressResources: CrudResourceConfig[] = [
  {
    name: "addresses",
    path: "",
    tag: "Addresses",
    table: addresses,
    ...addressSchemas,
    ownerColumn: addresses.userId,
    ownerKey: "userId",
  },
];
