import { relations } from "drizzle-orm";
import { type AnyPgColumn, index, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";
import { user } from "../auth";
import { referenceColumns } from "../reference-columns";

export const region = pgTable(
  "region",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    ...referenceColumns((): AnyPgColumn => user.id),
  },
  (table) => [
    uniqueIndex("region_name_uidx").on(table.name),
    index("region_isDeleted_createdAt_idx").on(table.isDeleted, table.createdAt),
    index("region_isDeleted_updatedAt_idx").on(table.isDeleted, table.updatedAt),
  ]
);

export const zone = pgTable(
  "zone",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    regionId: text("region_id")
      .notNull()
      .references(() => region.id, { onDelete: "restrict" }),
    ...referenceColumns((): AnyPgColumn => user.id),
  },
  (table) => [
    index("zone_regionId_idx").on(table.regionId),
    uniqueIndex("zone_regionId_name_uidx").on(table.regionId, table.name),
    index("zone_isDeleted_createdAt_idx").on(table.isDeleted, table.createdAt),
    index("zone_isDeleted_updatedAt_idx").on(table.isDeleted, table.updatedAt),
  ]
);

export const zoneLocation = pgTable(
  "zone_location",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    locationType: text("type"),
    description: text("description"),
    zoneId: text("zone_id")
      .notNull()
      .references(() => zone.id, { onDelete: "restrict" }),
    address: text("address"),
    latitude: text("latitude"),
    longitude: text("longitude"),
    ...referenceColumns((): AnyPgColumn => user.id),
  },
  (table) => [
    index("zone_location_zoneId_idx").on(table.zoneId),
    index("zone_location_type_idx").on(table.locationType),
    uniqueIndex("zone_location_zoneId_name_uidx").on(table.zoneId, table.name),
    index("zone_location_isDeleted_createdAt_idx").on(table.isDeleted, table.createdAt),
    index("zone_location_isDeleted_updatedAt_idx").on(table.isDeleted, table.updatedAt),
  ]
);

export const regionRelations = relations(region, ({ many }) => ({
  zones: many(zone),
}));

export const zoneRelations = relations(zone, ({ many, one }) => ({
  region: one(region, {
    fields: [zone.regionId],
    references: [region.id],
  }),
  locations: many(zoneLocation),
}));

export const zoneLocationRelations = relations(zoneLocation, ({ one }) => ({
  zone: one(zone, {
    fields: [zoneLocation.zoneId],
    references: [zone.id],
  }),
}));
