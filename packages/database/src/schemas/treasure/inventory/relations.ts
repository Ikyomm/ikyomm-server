import { relations } from "drizzle-orm";
import { productVariants } from "../products/schema";
import { inventory, warehouses } from "./schema";

export const warehouseRelations = relations(warehouses, ({ many }) => ({
  inventory: many(inventory),
}));

export const inventoryRelations = relations(inventory, ({ one }) => ({
  variant: one(productVariants, {
    fields: [inventory.variantId],
    references: [productVariants.id],
  }),
  warehouse: one(warehouses, {
    fields: [inventory.warehouseId],
    references: [warehouses.id],
  }),
}));
