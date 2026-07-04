import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppBindings } from "@/types/app";
import { registerBrandResources } from "./utils";

export const brandsGroup = new OpenAPIHono<AppBindings>();
registerBrandResources(brandsGroup);
