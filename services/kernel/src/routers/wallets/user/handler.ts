import type { AppBindings } from "@/types/app";
import { OpenAPIHono } from "@hono/zod-openapi";
import { createSuccessResponse, registerOpenApiRoute } from "@ikyomm/utils";
import { fetchUserWalletTransactionList } from "./list";
import { listTransactions } from "./openapi.route";

export const userWalletGroup = new OpenAPIHono<AppBindings>();

registerOpenApiRoute(userWalletGroup, listTransactions, async (c) => {
  const { id } = c.req.valid("param");
  const query = c.req.valid("query");
  const response = await fetchUserWalletTransactionList(id, query);

  return c.json(createSuccessResponse(response), 200);
});
