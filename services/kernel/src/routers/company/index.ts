import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppBindings } from "@/types/app";
import { companyMainGroup } from "./main/handler";
import { companyMembersGroup } from "./members/handler";

export const companyGroup = new OpenAPIHono<AppBindings>();

companyGroup.route("/members", companyMembersGroup);
companyGroup.route("/", companyMainGroup);
