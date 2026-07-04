import type { OpenAPIHono } from "@hono/zod-openapi";
import type { AppBindings } from "@/types/app";
import { registerCrudResource } from "../shared/crud";
import { inventoryResources } from "./openapi.route";

export function registerInventoryResources(app: OpenAPIHono<AppBindings>) {
  for (const resource of inventoryResources) registerCrudResource(app, resource);
}
