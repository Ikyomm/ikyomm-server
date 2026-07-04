import { type AnyPgColumn, boolean, index, pgTable, text } from "drizzle-orm/pg-core";
import { user } from "../../auth/schema";
import { referenceColumns } from "../../reference-columns";
import { AddressType } from "./enums";

export const addresses = pgTable(
  "treasure_addresses",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    type: AddressType("type").notNull(),
    recipientName: text("recipient_name").notNull(),
    phoneNumber: text("phone_number"),
    addressLine1: text("address_line_1").notNull(),
    addressLine2: text("address_line_2"),
    city: text("city").notNull(),
    state: text("state").notNull(),
    country: text("country").default("India").notNull(),
    pincode: text("pincode").notNull(),
    isDefault: boolean("is_default").default(false).notNull(),
    ...referenceColumns((): AnyPgColumn => user.id),
  },
  (table) => [
    index("treasure_addresses_user_id_idx").on(table.userId),
    index("treasure_addresses_user_type_idx").on(table.userId, table.type),
  ]
);
