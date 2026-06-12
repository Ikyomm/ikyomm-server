import { db, organizationWallet } from "@ikyomm/database";
import { and, eq } from "drizzle-orm";

export async function findCompanyWallet(
  organizationId: string,
  options?: { includeDeleted?: boolean }
) {
  return db.query.organizationWallet.findFirst({
    where: options?.includeDeleted
      ? eq(organizationWallet.organizationId, organizationId)
      : and(
          eq(organizationWallet.organizationId, organizationId),
          eq(organizationWallet.isDeleted, false)
        ),
  });
}
