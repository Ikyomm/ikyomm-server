import { reviews } from "@ikyomm/database";
import type { CrudResourceConfig } from "../shared/crud";
import { reviewSchemas } from "./schema";

export const reviewResources: CrudResourceConfig[] = [
  {
    name: "reviews",
    path: "",
    tag: "Reviews",
    table: reviews,
    ...reviewSchemas,
    ownerColumn: reviews.userId,
    ownerKey: "userId",
  },
];
