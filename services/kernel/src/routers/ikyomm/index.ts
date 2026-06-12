import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppBindings } from "@/types/app";
import { ikyommRolesPermissionGroup } from "./roles-permission/handler";
import { ikyommUsersGroup } from "./users";

export const ikyommGroup = new OpenAPIHono<AppBindings>();

ikyommGroup.route("/roles-permission", ikyommRolesPermissionGroup);
ikyommGroup.route("/users", ikyommUsersGroup);
