import { index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { organization, user } from "../auth";
import { pods } from "../records/pods";
import { referenceColumns } from "../reference-columns";
import { PodSessionLogEventType, PodSessionStatus } from "./enums";
import type { PodSessionLogPayload } from "./types";

export const podSessions = pgTable(
  "pod_sessions",
  {
    id: text("id").primaryKey(),
    podId: text("pod_id")
      .notNull()
      .references(() => pods.id, { onDelete: "restrict" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    companyId: text("company_id").references(() => organization.id, { onDelete: "set null" }),
    status: PodSessionStatus("status").notNull().default("CONFIRMED"),
    startAt: timestamp("start_at").notNull(),
    endAt: timestamp("end_at").notNull(),
    ...referenceColumns(() => user.id),
  },
  (table) => [
    index("pod_sessions_podId_status_endAt_idx").on(table.podId, table.status, table.endAt),
    index("pod_sessions_userId_idx").on(table.userId),
    index("pod_sessions_companyId_idx").on(table.companyId),
    index("pod_sessions_startAt_idx").on(table.startAt),
    index("pod_sessions_endAt_idx").on(table.endAt),
    index("pod_sessions_isDeleted_createdAt_idx").on(table.isDeleted, table.createdAt),
  ]
);

export const podSessionLogs = pgTable(
  "pod_session_logs",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => podSessions.id, { onDelete: "cascade" }),
    eventType: PodSessionLogEventType("event_type").notNull(),
    payload: jsonb("payload").$type<PodSessionLogPayload>().notNull().default({}),
    occurredAt: timestamp("occurred_at").defaultNow().notNull(),
    ...referenceColumns(() => user.id),
  },
  (table) => [
    index("pod_session_logs_sessionId_occurredAt_idx").on(table.sessionId, table.occurredAt),
    index("pod_session_logs_eventType_idx").on(table.eventType),
    index("pod_session_logs_isDeleted_createdAt_idx").on(table.isDeleted, table.createdAt),
  ]
);
