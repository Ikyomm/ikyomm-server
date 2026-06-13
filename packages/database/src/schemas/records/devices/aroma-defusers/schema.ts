import { index, jsonb, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";
import { user } from "../../../auth";
import { referenceColumns } from "../../../reference-columns";
import type { AromaDefuserContainer } from "./types";

export const aromaDefusers = pgTable(
  "aroma_defuser",
  {
    id: text("id").primaryKey(),
    name: text("name"),
    macId: text("mac_id").notNull(),
    containers: jsonb("containers").$type<AromaDefuserContainer[]>().notNull().default([]),
    ...referenceColumns(() => user.id),
  },
  (table) => [
    index("aroma_defuser_name_idx").on(table.name),
    uniqueIndex("aroma_defuser_macId_uidx").on(table.macId),
    index("aroma_defuser_macId_idx").on(table.macId),
    index("aroma_defuser_isDeleted_createdAt_idx").on(table.isDeleted, table.createdAt),
    index("aroma_defuser_isDeleted_updatedAt_idx").on(table.isDeleted, table.updatedAt),
  ]
);
