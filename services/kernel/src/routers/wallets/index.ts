import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppBindings } from "@/types/app";
import { companyWalletGroup } from "./company/handler";
import { ikyommWalletGroup } from "./ikyomm/handler";
import { userWalletGroup } from "./user/handler";

export const walletsGroup = new OpenAPIHono<AppBindings>();

walletsGroup.route("/company", companyWalletGroup);
walletsGroup.route("/ikyomm", ikyommWalletGroup);
walletsGroup.route("/user", userWalletGroup);
