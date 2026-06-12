import { DATABASE_RESOURCES } from "@ikyomm/database";
import {
  createApiSuccessResponse,
  createOpenApiRoute,
  createOperationalRateLimit,
  createResourceRbacGuards,
  DEFAULT_FAST_RBAC_AUTH_OPTIONS,
  IdStringParamSchema,
} from "@ikyomm/utils";
import {
  userWalletTransactionListQuerySchema,
  userWalletTransactionListResponseSchema,
} from "./schema";

const tags = ["Wallets / User"];

const walletTransactionsRbac = createResourceRbacGuards({
  resource: DATABASE_RESOURCES.wallet_transactions,
  auth: {
    ...DEFAULT_FAST_RBAC_AUTH_OPTIONS,
    enableRedisCache: false,
  },
});

const walletMethodsRateLimit = createOperationalRateLimit({
  keyPrefix: "wallets-user-methods",
});

export const listTransactions = createOpenApiRoute({
  method: "get",
  path: "/{id}/transactions/list",
  operationId: "userWalletTransactionList",
  tags,
  middleware: [walletMethodsRateLimit, walletTransactionsRbac.custom("getAll")],
  summary: "List user wallet transactions",
  request: {
    params: IdStringParamSchema(),
    query: userWalletTransactionListQuerySchema,
  },
  responses: {
    200: createApiSuccessResponse(
      userWalletTransactionListResponseSchema,
      "User wallet transactions fetched successfully"
    ),
  },
});
