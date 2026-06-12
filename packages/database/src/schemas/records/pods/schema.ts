import { index, jsonb, pgTable, real, text } from "drizzle-orm/pg-core";
import { OmmPodStatus, OmmPodType } from "../enums";
import { user } from "../../auth";
import { zoneLocation } from "../../location";
import { referenceColumns } from "../../reference-columns";
import { ConnectedDeviceConfigItem, RateSlab } from "./types";

export const pods = pgTable(
  "pods",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    type: OmmPodType("type").notNull(),
    status: OmmPodStatus("status").notNull(),

    // rate config
    rateConfig: jsonb("rate_config").$type<RateSlab[]>().default([]),

    // Metadata
    locationId: text("location_id").references(() => zoneLocation.id, { onDelete: "set null" }),
    connectedDeviceConfig: jsonb("connected_device_config")
      .$type<ConnectedDeviceConfigItem[]>()
      .notNull()
      .default([]),
    ...referenceColumns(() => user.id),
  },
  (table) => [
    index("pods_name_idx").on(table.name),
    index("pods_type_idx").on(table.type),
    index("pods_status_idx").on(table.status),
    index("pods_locationId_idx").on(table.locationId),
    index("pods_isDeleted_createdAt_idx").on(table.isDeleted, table.createdAt),
    index("pods_isDeleted_updatedAt_idx").on(table.isDeleted, table.updatedAt),
  ]
);
