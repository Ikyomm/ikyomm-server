/** biome-ignore-all lint/suspicious/noExplicitAny: Drizzle query builders are intentionally passed through reusable helpers. */
import { aromaDefusers, getDB } from "@ikyomm/database";
import { createTableListFetcher } from "@ikyomm/utils";
import { eq } from "drizzle-orm";
import type { AromaDefuserListQuery } from "./schema";

export const fetchAromaDefuserList = createTableListFetcher<
  typeof aromaDefusers,
  typeof aromaDefusers.$inferSelect,
  AromaDefuserListQuery
>({
  db: getDB,
  table: aromaDefusers,
  where: ({ params }) => eq(aromaDefusers.isDeleted, params.isDeleted ?? false),
  search: {
    exact: [aromaDefusers.id, aromaDefusers.macId],
    prefix: [aromaDefusers.macId],
    contains: [aromaDefusers.macId],
  },
  sorting: {
    defaultBy: "createdAt",
    defaultOrder: "desc",
  },
  sortColumns: {
    id: aromaDefusers.id,
    macId: aromaDefusers.macId,
    createdAt: aromaDefusers.createdAt,
    updatedAt: aromaDefusers.updatedAt,
  },
});
