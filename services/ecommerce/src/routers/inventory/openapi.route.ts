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
    permissionResource: "treasure_warehouses",
    searchColumns: [warehouses.name, warehouses.city, warehouses.state, warehouses.pincode],
    sortColumns: {
      name: warehouses.name,
      createdAt: warehouses.createdAt,
      updatedAt: warehouses.updatedAt,
    },
  },
  {
    name: "inventory records",
    path: "stocks",
    tag: "Inventory",
    table: inventory,
    ...inventorySchemas,
    staffWrite: true,
    permissionResource: "treasure_inventory",
  },
];
