import { db, ikyommWallet } from "@ikyomm/database";
import { and, eq } from "drizzle-orm";

export async function findIkyommWallet(options?: { includeDeleted?: boolean }) {
  return db.query.ikyommWallet.findFirst({
    where: options?.includeDeleted
      ? eq(ikyommWallet.singletonKey, "ikyomm")
      : and(eq(ikyommWallet.singletonKey, "ikyomm"), eq(ikyommWallet.isDeleted, false)),
  });
}
