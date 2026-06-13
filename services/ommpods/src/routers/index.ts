import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppBindings } from "@/types/app";
import { appGroup } from "./app/handler";
import { controlGroup } from "./control/handler";
import { pollingGroup } from "./polling/handler";
import { sessionsGroup } from "./sessions/handler";

export const ommpodsRoutes = new OpenAPIHono<AppBindings>();

ommpodsRoutes.route("/sessions", sessionsGroup);
ommpodsRoutes.route("/control", controlGroup);
ommpodsRoutes.route("/polling", pollingGroup);
ommpodsRoutes.route("/app", appGroup);
