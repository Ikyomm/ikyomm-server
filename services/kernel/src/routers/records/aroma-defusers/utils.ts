import { aromaDefusers, db } from "@ikyomm/database";
import { and, eq, ne } from "drizzle-orm";

type IncludeDeletedOptions = {
  includeDeleted?: boolean;
};

export async function findAromaDefuserById(id: string, options?: IncludeDeletedOptions) {
  return db.query.aromaDefusers.findFirst({
    where: options?.includeDeleted
      ? eq(aromaDefusers.id, id)
      : and(eq(aromaDefusers.id, id), eq(aromaDefusers.isDeleted, false)),
  });
}

export async function findAromaDefuserByMacId(macId: string, excludeId?: string) {
  return db.query.aromaDefusers.findFirst({
    columns: {
      id: true,
      macId: true,
    },
    where: and(
      eq(aromaDefusers.macId, macId),
      eq(aromaDefusers.isDeleted, false),
      excludeId ? ne(aromaDefusers.id, excludeId) : undefined
    ),
  });
}
