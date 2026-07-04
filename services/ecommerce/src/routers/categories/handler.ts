import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppBindings } from "@/types/app";
import { registerCategoryResources } from "./utils";

export const categoriesGroup = new OpenAPIHono<AppBindings>();
registerCategoryResources(categoriesGroup);
