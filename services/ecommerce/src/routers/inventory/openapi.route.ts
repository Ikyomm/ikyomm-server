import { inventory, warehouses } from "@ikyomm/database";
import type { CrudResourceConfig } from "../shared/crud";
import { inventorySchemas, warehouseSchemas } from "./schema";

export const inventoryResources: CrudResourceConfig[] = [
  {
    name: "warehouses",
    path: "warehouses",
    tag: "Inventory",
    table: warehouses,
    ...warehouseSchemas,
    staffWrite: true,
  },
  {
    name: "inventory records",
    path: "stocks",
    tag: "Inventory",
    table: inventory,
    ...inventorySchemas,
    staffWrite: true,
  },
];
