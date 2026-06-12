import { account, db, session, user } from "@ikyomm/database";
import {
  decryptPassword,
  encryptPassword,
  generateRandomPassword,
  generateUID,
  PasswordUtils,
} from "@ikyomm/utils";
import { and, desc, eq, ne, sql } from "drizzle-orm";

type IncludeDeletedOptions = {
  includeDeleted?: boolean;
};

export async function findOmmpodsUserById(id: string, options?: IncludeDeletedOptions) {
  const whereClause = options?.includeDeleted
    ? and(eq(user.id, id), eq(user.panel, "ikyomm"))
    : and(eq(user.id, id), eq(user.panel, "ikyomm"), eq(user.isDeleted, false));

  return db
    .select()
    .from(user)
    .where(whereClause)
    .limit(1)
    .then((rows) => rows[0]);
}

export async function findOmmpodsUserConflictByEmail(email: string, excludeUserId?: string) {
  const normalizedEmail = email.trim().toLowerCase();

  return db
    .select({ id: user.id })
    .from(user)
    .where(
      and(
        eq(sql`lower(${user.email})`, normalizedEmail),
        eq(user.isDeleted, false),
        excludeUserId ? ne(user.id, excludeUserId) : undefined
      )
    )
    .limit(1)
    .then((rows) => rows[0]);
}

export async function findOmmpodsUserConflictByPhoneNumber(
  phoneNumber: string,
  excludeUserId?: string
) {
  const normalizedPhoneNumber = phoneNumber.replace(/\D/g, "");

  return db
    .select({ id: user.id })
    .from(user)
    .where(
      and(
        sql`regexp_replace(coalesce(${user.phoneNumber}, ''), '\\D', '', 'g') = ${normalizedPhoneNumber}`,
        eq(user.isDeleted, false),
        excludeUserId ? ne(user.id, excludeUserId) : undefined
      )
    )
    .limit(1)
    .then((rows) => rows[0]);
}

export async function createOmmpodsUserAuthSeed(secret: string) {
  const password = generateRandomPassword();
  const [hashedPassword, accountId] = await Promise.all([
    PasswordUtils.hash(password),
    Promise.resolve(encryptPassword(password, secret)),
  ]);

  return {
    userId: generateUID(),
    password,
    hashedPassword,
    accountId,
  };
}

export async function getOmmpodsUserCredentialDeliveryData(id: string, secret: string) {
  const userData = await findOmmpodsUserById(id);

  if (!userData) {
    return {
      success: false as const,
      message: "Ommpods user not found",
    };
  }

  const userAccount = await db
    .select({ id: account.id })
    .from(account)
    .where(and(eq(account.userId, userData.id), eq(account.providerId, "credential")))
    .limit(1)
    .then((rows) => rows[0]);

  if (!userAccount?.id) {
    return {
      success: false as const,
      message: "Ommpods user account not found",
    };
  }

  const password = decryptPassword(userAccount.id, secret);
  const hashedPassword = await PasswordUtils.hash(password);

  await db
    .update(account)
    .set({
      password: hashedPassword,
    })
    .where(eq(account.id, userAccount.id));

  return {
    success: true as const,
    data: {
      email: userData.email,
      password,
      role: userData.role ?? "ommpods",
    },
  };
}

export async function listOmmpodsUserSessions(id: string) {
  return db
    .select()
    .from(session)
    .where(eq(session.userId, id))
    .orderBy(desc(session.updatedAt), desc(session.createdAt));
}
