import { DATABASE_RESOURCES } from "@ikyomm/database";
import {
  createApiJsonBody,
  createApiSuccessResponse,
  createOpenApiRoute,
  createOperationalRateLimit,
  createResourceRbacGuards,
  DEFAULT_FAST_RBAC_AUTH_OPTIONS,
  IdStringParamSchema,
} from "@ikyomm/utils";
import {
  ikyommWalletAddCreditsSchema,
  ikyommWalletCreateSchema,
  ikyommWalletNullableSchema,
  ikyommWalletSchema,
  ikyommWalletTransactionListQuerySchema,
  ikyommWalletTransactionListResponseSchema,
} from "./schema";

const tags = ["Wallets / Ikyomm"];

const ikyommWalletRbac = createResourceRbacGuards({
  resource: DATABASE_RESOURCES.ikyomm_wallet,
  auth: {
    ...DEFAULT_FAST_RBAC_AUTH_OPTIONS,
    enableRedisCache: false,
  },
});

const walletTransactionsRbac = createResourceRbacGuards({
  resource: DATABASE_RESOURCES.wallet_transactions,
  auth: {
    ...DEFAULT_FAST_RBAC_AUTH_OPTIONS,
    enableRedisCache: false,
  },
});

const walletMethodsRateLimit = createOperationalRateLimit({
  keyPrefix: "wallets-ikyomm-methods",
});

export const get = createOpenApiRoute({
  method: "get",
  path: "/",
  operationId: "ikyommWalletGet",
  tags,
  middleware: [walletMethodsRateLimit, ikyommWalletRbac.custom("get")],
  summary: "Get the Ikyomm wallet",
  responses: {
    200: createApiSuccessResponse(ikyommWalletNullableSchema, "Ikyomm wallet fetched successfully"),
  },
});

export const create = createOpenApiRoute({
  method: "post",
  path: "/",
  operationId: "ikyommWalletCreate",
  tags,
  middleware: [walletMethodsRateLimit, ikyommWalletRbac.custom("create")],
  summary: "Create the Ikyomm wallet",
  request: {
    body: createApiJsonBody(ikyommWalletCreateSchema),
  },
  responses: {
    201: createApiSuccessResponse(ikyommWalletSchema, "Ikyomm wallet created successfully"),
    200: createApiSuccessResponse(ikyommWalletSchema, "Ikyomm wallet already exists"),
  },
});

export const addCredits = createOpenApiRoute({
  method: "post",
  path: "/credits",
  operationId: "ikyommWalletAddCredits",
  tags,
  middleware: [walletMethodsRateLimit, ikyommWalletRbac.custom("addCredits")],
  summary: "Add credit minutes to the Ikyomm wallet",
  request: {
    body: createApiJsonBody(ikyommWalletAddCreditsSchema),
  },
  responses: {
    200: createApiSuccessResponse(ikyommWalletSchema, "Credit minutes added successfully"),
  },
});

export const transferUserCredits = createOpenApiRoute({
  method: "post",
  path: "/users/{userId}/credits",
  operationId: "ikyommWalletTransferUserCredits",
  tags,
  middleware: [walletMethodsRateLimit, ikyommWalletRbac.custom("addCredits")],
  summary: "Transfer credit minutes from the Ikyomm wallet to a user wallet",
  request: {
    params: IdStringParamSchema().extend({
      userId: IdStringParamSchema().shape.id,
    }),
    body: createApiJsonBody(ikyommWalletAddCreditsSchema.omit({ type: true })),
  },
  responses: {
    200: createApiSuccessResponse(
      ikyommWalletSchema,
      "User credit minutes transferred successfully"
    ),
  },
});

export const listTransactions = createOpenApiRoute({
  method: "get",
  path: "/transactions/list",
  operationId: "ikyommWalletTransactionList",
  tags,
  middleware: [walletMethodsRateLimit, walletTransactionsRbac.custom("getAll")],
  summary: "List Ikyomm wallet transactions",
  request: {
    query: ikyommWalletTransactionListQuerySchema,
  },
  responses: {
    200: createApiSuccessResponse(
      ikyommWalletTransactionListResponseSchema,
      "Ikyomm wallet transactions fetched successfully"
    ),
  },
});
