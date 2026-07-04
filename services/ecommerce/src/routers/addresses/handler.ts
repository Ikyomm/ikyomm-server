import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppBindings } from "@/types/app";
import { registerAddressResources } from "./utils";

export const addressesGroup = new OpenAPIHono<AppBindings>();
registerAddressResources(addressesGroup);
