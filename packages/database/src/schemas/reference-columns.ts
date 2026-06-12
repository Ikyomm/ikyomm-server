import { type AnyPgColumn, boolean, text, timestamp } from "drizzle-orm/pg-core";

export const referenceColumns = (getUserId: () => AnyPgColumn) => ({
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
  createdByUser: text("created_by_user").references(getUserId, {
    onDelete: "set null",
  }),
  updatedByUser: text("updated_by_user").references(getUserId, {
    onDelete: "set null",
  }),
  deletedByUser: text("deleted_by_user").references(getUserId, {
    onDelete: "set null",
  }),
  isDeleted: boolean("is_deleted").default(false).notNull(),
});
