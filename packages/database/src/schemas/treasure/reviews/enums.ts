import { pgEnum } from "drizzle-orm/pg-core";

export const ReviewStatus = pgEnum("treasure_review_status", ["PENDING", "PUBLISHED", "REJECTED"]);

export type ReviewStatus = (typeof ReviewStatus.enumValues)[number];
