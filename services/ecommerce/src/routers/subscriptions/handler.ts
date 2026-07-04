import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppBindings } from "@/types/app";
import { registerCrudResource } from "../shared/crud";
import { subscriptionResources } from "./openapi.route";

export const subscriptionsGroup = new OpenAPIHono<AppBindings>();
for (const resource of subscriptionResources) registerCrudResource(subscriptionsGroup, resource);
