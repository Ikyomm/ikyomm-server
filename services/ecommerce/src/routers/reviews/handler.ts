import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppBindings } from "@/types/app";
import { registerCrudResource } from "../shared/crud";
import { reviewResources } from "./openapi.route";

export const reviewsGroup = new OpenAPIHono<AppBindings>();
for (const resource of reviewResources) registerCrudResource(reviewsGroup, resource);
