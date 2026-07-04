import { pgEnum } from "drizzle-orm/pg-core";

export const BrandStatus = pgEnum("treasure_brand_status", ["ACTIVE", "INACTIVE"]);

export type BrandStatus = (typeof BrandStatus.enumValues)[number];
