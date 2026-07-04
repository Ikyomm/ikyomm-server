import { pgEnum } from "drizzle-orm/pg-core";

export const WarehouseStatus = pgEnum("treasure_warehouse_status", ["ACTIVE", "INACTIVE"]);

export type WarehouseStatus = (typeof WarehouseStatus.enumValues)[number];
