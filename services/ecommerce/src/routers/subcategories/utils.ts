import type { OpenAPIHono } from "@hono/zod-openapi";
import type { AppBindings } from "@/types/app";
import { registerCrudResource } from "../shared/crud";
import { subcategoryResources } from "./openapi.route";

export function registerSubcategoryResources(app: OpenAPIHono<AppBindings>) {
  for (const resource of subcategoryResources) registerCrudResource(app, resource);
}
