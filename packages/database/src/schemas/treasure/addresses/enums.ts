import { pgEnum } from "drizzle-orm/pg-core";

export const AddressType = pgEnum("treasure_address_type", ["BILLING", "SHIPPING"]);

export type AddressType = (typeof AddressType.enumValues)[number];
