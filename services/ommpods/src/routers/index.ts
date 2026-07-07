import type { AppBindings } from "@/types/app";
import { createOpenApiHono } from "@/lib/openapi-hono";
import { appGroup } from "./app/handler";
import { controlGroup } from "./control/handler";
import { sessionsGroup } from "./sessions/handler";
import { tabletGroup } from "./tablet/handler";

export const ommpodsRoutes = createOpenApiHono<AppBindings>();

ommpodsRoutes.route("/sessions", sessionsGroup);
ommpodsRoutes.route("/control", controlGroup);
ommpodsRoutes.route("/app", appGroup);
ommpodsRoutes.route("/tablet", tabletGroup);
