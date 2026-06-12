import { db, userWallet } from "@ikyomm/database";
import { and, eq } from "drizzle-orm";

export const findUserWallet = async (userId: string) =>
  db.query.userWallet.findFirst({
    where: and(eq(userWallet.userId, userId), eq(userWallet.isDeleted, false)),
  });
