import type { OpenAPIHono } from "@hono/zod-openapi";
import type { AppBindings } from "@/types/app";
import { registerCrudResource } from "../shared/crud";
import { addressResources } from "./openapi.route";

export function registerAddressResources(app: OpenAPIHono<AppBindings>) {
  for (const resource of addressResources) registerCrudResource(app, resource);
}
