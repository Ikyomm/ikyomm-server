import { pgEnum } from "drizzle-orm/pg-core";

export const OmmPodType = pgEnum("ommpod_type", ["NEO", "PRIMO", "RESTORE", "SIGNATURE"]);
export const OmmPodStatus = pgEnum("ommpod_status", [
  "ACTIVE",
  "INACTIVE",
  "MAINTENANCE",
  "DECOMMISSIONED",
]);

export type OmmPodType = (typeof OmmPodType.enumValues)[number];
export type OmmPodStatus = (typeof OmmPodStatus.enumValues)[number];
