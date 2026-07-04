import { pgEnum } from "drizzle-orm/pg-core";

export const CategoryStatus = pgEnum("treasure_category_status", ["ACTIVE", "INACTIVE"]);

export type CategoryStatus = (typeof CategoryStatus.enumValues)[number];
