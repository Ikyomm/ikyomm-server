import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppBindings } from "@/types/app";
import { registerSubcategoryResources } from "./utils";

export const subcategoriesGroup = new OpenAPIHono<AppBindings>();
registerSubcategoryResources(subcategoriesGroup);
