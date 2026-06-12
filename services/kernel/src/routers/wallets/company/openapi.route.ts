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
  companyWalletAddCreditsSchema,
  companyWalletCreateSchema,
  companyWalletNullableSchema,
  companyWalletSchema,
  companyWalletTransactionListQuerySchema,
  companyWalletTransactionListResponseSchema,
} from "./schema";

const tags = ["Wallets / Company"];

const companyWalletRbac = createResourceRbacGuards({
  resource: DATABASE_RESOURCES.organization_wallet,
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
  keyPrefix: "wallets-company-methods",
});

export const get = createOpenApiRoute({
  method: "get",
  path: "/{id}",
  operationId: "companyWalletGet",
  tags,
  middleware: [walletMethodsRateLimit, companyWalletRbac.custom("get")],
  summary: "Get a company wallet",
  request: {
    params: IdStringParamSchema(),
  },
  responses: {
    200: createApiSuccessResponse(
      companyWalletNullableSchema,
      "Company wallet fetched successfully"
    ),
  },
});

export const create = createOpenApiRoute({
  method: "post",
  path: "/{id}",
  operationId: "companyWalletCreate",
  tags,
  middleware: [walletMethodsRateLimit, companyWalletRbac.custom("create")],
  summary: "Create a company wallet",
  request: {
    params: IdStringParamSchema(),
    body: createApiJsonBody(companyWalletCreateSchema),
  },
  responses: {
    201: createApiSuccessResponse(companyWalletSchema, "Company wallet created successfully"),
    200: createApiSuccessResponse(companyWalletSchema, "Company wallet already exists"),
  },
});

export const addCredits = createOpenApiRoute({
  method: "post",
  path: "/{id}/credits",
  operationId: "companyWalletAddCredits",
  tags,
  middleware: [walletMethodsRateLimit, companyWalletRbac.custom("addCredits")],
  summary: "Transfer credit minutes from Ikyomm wallet to a company wallet",
  request: {
    params: IdStringParamSchema(),
    body: createApiJsonBody(companyWalletAddCreditsSchema),
  },
  responses: {
    200: createApiSuccessResponse(companyWalletSchema, "Credit minutes transferred successfully"),
  },
});

export const transferUserCredits = createOpenApiRoute({
  method: "post",
  path: "/{id}/users/{userId}/credits",
  operationId: "companyWalletTransferUserCredits",
  tags,
  middleware: [walletMethodsRateLimit, companyWalletRbac.custom("addCredits")],
  summary: "Transfer credit minutes from a company wallet to a user wallet",
  request: {
    params: IdStringParamSchema().extend({
      userId: IdStringParamSchema().shape.id,
    }),
    body: createApiJsonBody(companyWalletAddCreditsSchema),
  },
  responses: {
    200: createApiSuccessResponse(
      companyWalletSchema,
      "User credit minutes transferred successfully"
    ),
  },
});

export const listTransactions = createOpenApiRoute({
  method: "get",
  path: "/{id}/transactions/list",
  operationId: "companyWalletTransactionList",
  tags,
  middleware: [walletMethodsRateLimit, walletTransactionsRbac.custom("getAll")],
  summary: "List company wallet transactions",
  request: {
    params: IdStringParamSchema(),
    query: companyWalletTransactionListQuerySchema,
  },
  responses: {
    200: createApiSuccessResponse(
      companyWalletTransactionListResponseSchema,
      "Company wallet transactions fetched successfully"
    ),
  },
});
