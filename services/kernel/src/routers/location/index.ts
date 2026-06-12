import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppBindings } from "@/types/app";
import { locationCrudGroup } from "./handler";

export const locationGroup = new OpenAPIHono<AppBindings>();

locationGroup.route("/", locationCrudGroup);
