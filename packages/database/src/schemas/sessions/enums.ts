import { pgEnum } from "drizzle-orm/pg-core";

export const PodSessionStatus = pgEnum("pod_session_status", [
  "CONFIRMED",
  "CANCELLED",
  "COMPLETED",
  "EMERGENCY_UNLOCKED",
]);

export const PodSessionLogEventType = pgEnum("pod_session_log_event_type", [
  "SESSION_CREATED",
  "MOOD_CHANGED",
  "AROMA_CHANGED",
  "MUSIC_CHANGED",
]);

export type PodSessionStatus = (typeof PodSessionStatus.enumValues)[number];
export type PodSessionLogEventType = (typeof PodSessionLogEventType.enumValues)[number];
