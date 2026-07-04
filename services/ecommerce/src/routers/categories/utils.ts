import type { OpenAPIHono } from "@hono/zod-openapi";
import type { AppBindings } from "@/types/app";
import { registerCrudResource } from "../shared/crud";
import { categoryResources } from "./openapi.route";

export function registerCategoryResources(app: OpenAPIHono<AppBindings>) {
  for (const resource of categoryResources) registerCrudResource(app, resource);
}
