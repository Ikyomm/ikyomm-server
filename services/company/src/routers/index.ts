import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppBindings } from "@/types/app";
import { companyGroup } from "./company";

export const companyRoutes = new OpenAPIHono<AppBindings>();

companyRoutes.route("/", companyGroup);
