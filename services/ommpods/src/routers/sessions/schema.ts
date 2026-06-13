import {
  createApiSuccessResponse,
  createApiJsonBody,
  createListQuerySchema,
  createListResponseSchema,
  createOpenApiRoute,
  IdStringParamSchema,
  optionalBooleanQuerySchema,
} from "@ikyomm/utils";
import { z } from "@hono/zod-openapi";
import {
  DATABASE_RESOURCES,
  PodSessionLogEventType,
  PodSessionStatus,
  podSessionLogs,
  podSessions,
} from "@ikyomm/database";
import {
  createDbSelectSchema,
  createOperationalRateLimit,
  createResourceRbacGuards,
  DEFAULT_FAST_RBAC_AUTH_OPTIONS,
  RBAC_ACTIONS,
} from "@ikyomm/utils";
import { sessionResponseSchema } from "../shared";

export const sessionCreateSchema = z.object({
  podId: z.string().trim().min(1),
  rateMinute: z.coerce.number().int().positive(),
});

export const sessionCreateResponseSchema = sessionResponseSchema;

const tags = ["Sessions"];

const sessionsRbac = createResourceRbacGuards({
  resource: DATABASE_RESOURCES.pod_sessions,
  auth: {
    ...DEFAULT_FAST_RBAC_AUTH_OPTIONS,
    enableRedisCache: false,
  },
});

const sessionLogsRbac = createResourceRbacGuards({
  resource: DATABASE_RESOURCES.pod_session_logs,
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

const sessionMethodsRateLimit = createOperationalRateLimit({
  keyPrefix: "ommpods-sessions-methods",
});

const referenceUserSummarySchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  email: z.string().nullable(),
});

const referenceCompanySummarySchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
});

const referencePodSummarySchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
});

export const podSessionSchema = createDbSelectSchema(podSessions).extend({
  pod: referencePodSummarySchema.nullable(),
  user: referenceUserSummarySchema.nullable(),
  company: referenceCompanySummarySchema.nullable(),
  usageMinute: z.number().nullable(),
  creditMinute: z.number().nullable(),
});

export const podSessionLogSchema = createDbSelectSchema(podSessionLogs).extend({
  payload: z.record(z.string(), z.unknown()),
});

export const podSessionTransactionSchema = z.object({
  id: z.string(),
  type: z.enum(["CREDIT", "DEBIT", "TRANSFER", "ADJUSTMENT"]),
  status: z.enum(["PENDING", "COMPLETED", "FAILED", "CANCELLED"]),
  creditMinute: z.coerce.number(),
  reference: z.string().nullable(),
  description: z.string().nullable(),
  transactedAt: z.coerce.date(),
  fromUserWalletId: z.string().nullable(),
  fromOrganizationWalletId: z.string().nullable(),
  fromIkyommWalletId: z.string().nullable(),
  toUserWalletId: z.string().nullable(),
  toOrganizationWalletId: z.string().nullable(),
  toIkyommWalletId: z.string().nullable(),
  direction: z.enum(["credit", "debit", "internal"]),
});

export const podSessionUsageSchema = z.object({
  sessionId: z.string(),
  usageMinute: z.number().nullable(),
  creditMinute: z.number().nullable(),
  transactions: z.array(podSessionTransactionSchema),
});

export const podSessionListSortFields = [
  "id",
  "status",
  "podId",
  "userId",
  "companyId",
  "startAt",
  "endAt",
  "createdAt",
  "updatedAt",
] as const;

export const podSessionLogListSortFields = [
  "id",
  "eventType",
  "occurredAt",
  "createdAt",
  "updatedAt",
] as const;

export const podSessionTransactionListSortFields = [
  "id",
  "type",
  "status",
  "creditMinute",
  "transactedAt",
  "createdAt",
  "updatedAt",
] as const;

export const podSessionListQuerySchema = createListQuerySchema({
  sortFields: podSessionListSortFields,
  extraShape: {
    status: z.enum(PodSessionStatus.enumValues).optional(),
    podId: z.string().optional(),
    userId: z.string().optional(),
    companyId: z.string().optional(),
    userScope: z.enum(["company", "ikyomm"]).optional(),
    startDate: z.string().date().optional(),
    endDate: z.string().date().optional(),
    isDeleted: optionalBooleanQuerySchema,
  },
});

export const podSessionLogListQuerySchema = createListQuerySchema({
  sortFields: podSessionLogListSortFields,
  extraShape: {
    eventType: z.enum(PodSessionLogEventType.enumValues).optional(),
    isDeleted: optionalBooleanQuerySchema,
  },
});

export const podSessionTransactionListQuerySchema = createListQuerySchema({
  sortFields: podSessionTransactionListSortFields,
  extraShape: {
    type: z.enum(["CREDIT", "DEBIT", "TRANSFER", "ADJUSTMENT"]).optional(),
    status: z.enum(["PENDING", "COMPLETED", "FAILED", "CANCELLED"]).optional(),
    isDeleted: optionalBooleanQuerySchema,
  },
});

export type PodSessionListQuery = z.infer<typeof podSessionListQuerySchema>;
export type PodSessionLogListQuery = z.infer<typeof podSessionLogListQuerySchema>;
export type PodSessionTransactionListQuery = z.infer<typeof podSessionTransactionListQuerySchema>;

export const podSessionListResponseSchema = createListResponseSchema(podSessionSchema);
export const podSessionLogListResponseSchema = createListResponseSchema(podSessionLogSchema);
export const podSessionTransactionListResponseSchema = createListResponseSchema(
  podSessionTransactionSchema
);

export const podSessionDeleteResponseSchema = z.object({
  message: z.string(),
});

export const createSessionRoute = createOpenApiRoute({
  method: "post",
  path: "/",
  operationId: "ommpodsSessionCreate",
  tags,
  summary: "Create a live Pod session",
  request: {
    body: createApiJsonBody(sessionCreateSchema),
  },
  responses: {
    201: createApiSuccessResponse(sessionCreateResponseSchema, "Session created successfully"),
  },
});

export const listSessionsRoute = createOpenApiRoute({
  method: "get",
  path: "/list",
  operationId: "ommpodsSessionList",
  tags,
  middleware: [sessionMethodsRateLimit, sessionsRbac.custom("getAll")],
  summary: "List Ommpods sessions",
  request: {
    query: podSessionListQuerySchema,
  },
  responses: {
    200: createApiSuccessResponse(podSessionListResponseSchema, "Sessions fetched successfully"),
  },
});

export const getSessionRoute = createOpenApiRoute({
  method: "get",
  path: "/{id}",
  operationId: "ommpodsSessionGetById",
  tags,
  middleware: [sessionMethodsRateLimit, sessionsRbac.custom("get")],
  summary: "Get an Ommpods session",
  request: {
    params: IdStringParamSchema(),
  },
  responses: {
    200: createApiSuccessResponse(podSessionSchema, "Session fetched successfully"),
  },
});

export const listSessionLogsRoute = createOpenApiRoute({
  method: "get",
  path: "/{id}/logs/list",
  operationId: "ommpodsSessionLogList",
  tags,
  middleware: [sessionMethodsRateLimit, sessionLogsRbac.custom("getAll")],
  summary: "List logs for an Ommpods session",
  request: {
    params: IdStringParamSchema(),
    query: podSessionLogListQuerySchema,
  },
  responses: {
    200: createApiSuccessResponse(
      podSessionLogListResponseSchema,
      "Session logs fetched successfully"
    ),
  },
});

export const listSessionTransactionsRoute = createOpenApiRoute({
  method: "get",
  path: "/{id}/transactions/list",
  operationId: "ommpodsSessionTransactionList",
  tags,
  middleware: [sessionMethodsRateLimit, walletTransactionsRbac.custom("getAll")],
  summary: "List wallet transactions for an Ommpods session",
  request: {
    params: IdStringParamSchema(),
    query: podSessionTransactionListQuerySchema,
  },
  responses: {
    200: createApiSuccessResponse(
      podSessionTransactionListResponseSchema,
      "Session transactions fetched successfully"
    ),
  },
});

export const getSessionUsageRoute = createOpenApiRoute({
  method: "get",
  path: "/{id}/usage",
  operationId: "ommpodsSessionUsage",
  tags,
  middleware: [sessionMethodsRateLimit, sessionsRbac.custom("get")],
  summary: "Get usage and credit summary for an Ommpods session",
  request: {
    params: IdStringParamSchema(),
  },
  responses: {
    200: createApiSuccessResponse(podSessionUsageSchema, "Session usage fetched successfully"),
  },
});

export const deleteSessionRoute = createOpenApiRoute({
  method: "delete",
  path: "/{id}",
  operationId: "ommpodsSessionDeleteById",
  tags,
  middleware: [sessionMethodsRateLimit, sessionsRbac.custom("delete")],
  summary: "Soft delete an Ommpods session",
  request: {
    params: IdStringParamSchema(),
  },
  responses: {
    200: createApiSuccessResponse(podSessionDeleteResponseSchema, "Session deleted successfully"),
  },
});

export const permanentDeleteSessionRoute = createOpenApiRoute({
  method: "delete",
  path: "/{id}/permanent",
  operationId: "ommpodsSessionPermanentDeleteById",
  tags,
  middleware: [sessionMethodsRateLimit, sessionsRbac.custom("delete")],
  summary: "Permanently delete an Ommpods session",
  request: {
    params: IdStringParamSchema(),
  },
  responses: {
    200: createApiSuccessResponse(
      podSessionDeleteResponseSchema,
      "Session permanently deleted successfully"
    ),
  },
});

export const restoreSessionRoute = createOpenApiRoute({
  method: "patch",
  path: "/{id}/restore",
  operationId: "ommpodsSessionRestoreById",
  tags,
  middleware: [sessionMethodsRateLimit, sessionsRbac.custom(RBAC_ACTIONS.restore)],
  summary: "Restore a soft-deleted Ommpods session",
  request: {
    params: IdStringParamSchema(),
  },
  responses: {
    200: createApiSuccessResponse(podSessionDeleteResponseSchema, "Session restored successfully"),
  },
});
