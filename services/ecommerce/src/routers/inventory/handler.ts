import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppBindings } from "@/types/app";
import { registerInventoryResources } from "./utils";

export const inventoryGroup = new OpenAPIHono<AppBindings>();
registerInventoryResources(inventoryGroup);
