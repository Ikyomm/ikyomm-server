import type { OpenAPIHono } from "@hono/zod-openapi";
import type { AppBindings } from "@/types/app";
import { registerCrudResource } from "../shared/crud";
import { orderResources } from "./openapi.route";

export function registerOrderResources(app: OpenAPIHono<AppBindings>) {
  for (const resource of orderResources) registerCrudResource(app, resource);
}
