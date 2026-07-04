import { orderItems, orders, payments } from "@ikyomm/database";
import type { CrudResourceConfig } from "../shared/crud";
import { orderItemSchemas, orderSchemas, paymentSchemas } from "./schema";
import { validateOrderAddresses } from "./validation";

export const orderResources: CrudResourceConfig[] = [
  {
    name: "orders",
    path: "",
    tag: "Orders",
    table: orders,
    ...orderSchemas,
    ownerColumn: orders.userId,
    ownerKey: "userId",
    beforeCreate: ({ body, userId }) => validateOrderAddresses(body, userId),
    beforeUpdate: ({ body, userId }) => validateOrderAddresses(body, userId),
  },
  {
    name: "order items",
    path: "items",
    tag: "Orders",
    table: orderItems,
    ...orderItemSchemas,
    parentOrderColumn: orderItems.orderId,
    parentOrderKey: "orderId",
  },
  {
    name: "payments",
    path: "payments",
    tag: "Orders",
    table: payments,
    ...paymentSchemas,
    parentOrderColumn: payments.orderId,
    parentOrderKey: "orderId",
  },
];
