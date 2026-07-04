import type { OpenAPIHono } from "@hono/zod-openapi";
import type { AppBindings } from "@/types/app";
import { registerCrudResource } from "../shared/crud";
import { brandResources } from "./openapi.route";

export function registerBrandResources(app: OpenAPIHono<AppBindings>) {
  for (const resource of brandResources) registerCrudResource(app, resource);
}
