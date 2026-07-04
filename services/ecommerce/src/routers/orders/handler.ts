import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppBindings } from "@/types/app";
import { registerOrderResources } from "./utils";

export const ordersGroup = new OpenAPIHono<AppBindings>();
registerOrderResources(ordersGroup);
