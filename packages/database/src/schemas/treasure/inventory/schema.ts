import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  check,
  index,
  integer,
  pgTable,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { user } from "../../auth/schema";
import { referenceColumns } from "../../reference-columns";
import { productVariants } from "../products/schema";
import { WarehouseStatus } from "./enums";

export const warehouses = pgTable(
  "treasure_warehouses",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    code: text("code").notNull(),
    addressLine1: text("address_line_1").notNull(),
    addressLine2: text("address_line_2"),
    city: text("city").notNull(),
    state: text("state").notNull(),
    country: text("country").default("India").notNull(),
    pincode: text("pincode").notNull(),
    status: WarehouseStatus("status").default("ACTIVE").notNull(),
    ...referenceColumns((): AnyPgColumn => user.id),
  },
  (table) => [
    uniqueIndex("treasure_warehouses_code_uidx").on(table.code),
    index("treasure_warehouses_status_idx").on(table.status),
  ]
);

export const inventory = pgTable(
  "treasure_inventory",
  {
    id: text("id").primaryKey(),
    variantId: text("variant_id")
      .notNull()
      .references(() => productVariants.id, { onDelete: "cascade" }),
    warehouseId: text("warehouse_id")
      .notNull()
      .references(() => warehouses.id, { onDelete: "cascade" }),
    quantityAvailable: integer("quantity_available").default(0).notNull(),
    reservedQuantity: integer("reserved_quantity").default(0).notNull(),
    lowStockThreshold: integer("low_stock_threshold").default(0).notNull(),
    ...referenceColumns((): AnyPgColumn => user.id),
  },
  (table) => [
    uniqueIndex("treasure_inventory_variant_warehouse_uidx").on(table.variantId, table.warehouseId),
    index("treasure_inventory_warehouse_id_idx").on(table.warehouseId),
    check("treasure_inventory_quantity_available_check", sql`${table.quantityAvailable} >= 0`),
    check("treasure_inventory_reserved_quantity_check", sql`${table.reservedQuantity} >= 0`),
    check("treasure_inventory_low_stock_threshold_check", sql`${table.lowStockThreshold} >= 0`),
    check(
      "treasure_inventory_reservation_check",
      sql`${table.reservedQuantity} <= ${table.quantityAvailable}`
    ),
  ]
);
