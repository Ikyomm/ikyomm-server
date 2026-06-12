import { account, db, organization, rbacRole, session, user, userWallet } from "@ikyomm/database";
import {
  decryptPassword,
  encryptPassword,
  generateRandomPassword,
  generateUID,
  PasswordUtils,
} from "@ikyomm/utils";
import { and, desc, eq, isNull, ne, sql } from "drizzle-orm";

type IncludeDeletedOptions = {
  includeDeleted?: boolean;
};

export async function findOmmpodsAgentUserById(id: string, options?: IncludeDeletedOptions) {
  const whereClause = options?.includeDeleted
    ? and(eq(user.id, id), eq(user.panel, "app"))
    : and(eq(user.id, id), eq(user.panel, "app"), eq(user.isDeleted, false));

  return db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      country: user.country,
      state: user.state,
      city: user.city,
      address: user.address,
      company: user.company,
      employeeId: user.employeeId,
      employeeEmail: user.employeeEmail,
      image: user.image,
      role: user.role,
      panel: user.panel,
      banned: user.banned,
      banReason: user.banReason,
      banExpires: user.banExpires,
      phoneNumber: user.phoneNumber,
      phoneNumberVerified: user.phoneNumberVerified,
      deletedAt: user.deletedAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      createdByUser: user.createdByUser,
      updatedByUser: user.updatedByUser,
      deletedByUser: user.deletedByUser,
      isDeleted: user.isDeleted,
      organization,
      wallet: userWallet,
    })
    .from(user)
    .leftJoin(organization, eq(organization.id, user.company))
    .leftJoin(
      userWallet,
      and(eq(userWallet.userId, user.id), eq(userWallet.isDeleted, false))
    )
    .where(whereClause)
    .limit(1)
    .then((rows) => rows[0]);
}

export async function findActiveAppRoleBySlug(slug: string) {
  return db
    .select({ id: rbacRole.id, slug: rbacRole.slug })
    .from(rbacRole)
    .where(
      and(
        eq(rbacRole.slug, slug),
        eq(rbacRole.panel, "app"),
        isNull(rbacRole.organizationId),
        eq(rbacRole.isActive, true)
      )
    )
    .limit(1)
    .then((rows) => rows[0]);
}

export async function findActiveOrganizationById(id: string) {
  return db
    .select({ id: organization.id, name: organization.name })
    .from(organization)
    .where(
      and(eq(organization.id, id), eq(organization.isDeleted, false), eq(organization.isActive, true))
    )
    .limit(1)
    .then((rows) => rows[0]);
}

export async function findOmmpodsUserConflictByEmail(email: string, excludeId?: string) {
  const normalizedEmail = email.trim().toLowerCase();

  return db
    .select({ id: user.id })
    .from(user)
    .where(
      and(
        eq(sql`lower(${user.email})`, normalizedEmail),
        eq(user.isDeleted, false),
        excludeId ? ne(user.id, excludeId) : undefined
      )
    )
    .limit(1)
    .then((rows) => rows[0]);
}

export async function findOmmpodsUserConflictByPhoneNumber(
  phoneNumber: string,
  excludeId?: string
) {
  const normalizedPhoneNumber = phoneNumber.replace(/\D/g, "");

  return db
    .select({ id: user.id })
    .from(user)
    .where(
      and(
        sql`regexp_replace(coalesce(${user.phoneNumber}, ''), '\\D', '', 'g') = ${normalizedPhoneNumber}`,
        eq(user.isDeleted, false),
        excludeId ? ne(user.id, excludeId) : undefined
      )
    )
    .limit(1)
    .then((rows) => rows[0]);
}

export async function createOmmpodsAgentAuthSeed(secret: string) {
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

export async function getOmmpodsAgentUserCredentialDeliveryData(id: string, secret: string) {
  const userData = await findOmmpodsAgentUserById(id);

  if (!userData) {
    return {
      success: false as const,
      message: "App user not found",
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
      message: "App user account not found",
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
      agentName: userData.name,
      role: userData.role,
    },
  };
}

export async function listOmmpodsAgentUserSessions(id: string) {
  return db
    .select()
    .from(session)
    .where(eq(session.userId, id))
    .orderBy(desc(session.updatedAt), desc(session.createdAt));
}
