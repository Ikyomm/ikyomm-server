import { logger } from "@/lib/logger";
import { account, db, member, organization, rbacRole, user } from "@ikyomm/database";
import {
  decryptPassword,
  encryptPassword,
  generateNextCompanyId,
  generateRandomPassword,
  generateUID,
  ensureDefaultOrganizationRoles,
  PasswordUtils,
} from "@ikyomm/utils";
import { and, asc, desc, eq, ne, sql } from "drizzle-orm";

type IncludeDeletedOptions = {
  includeDeleted?: boolean;
};

export const ensureDefaultCompanyRoles = ensureDefaultOrganizationRoles;

const companySelectColumns = {
  id: organization.id,
  name: organization.name,
  slug: organization.slug,
  logo: organization.logo,
  type: organization.type,
  platformMode: organization.platformMode,
  metadata: organization.metadata,
  country: organization.country,
  state: organization.state,
  city: organization.city,
  address: organization.address,
  email: organization.email,
  phoneNumber: organization.phoneNumber,
  websiteDomain: organization.websiteDomain,
  isActive: organization.isActive,
  createdByUser: organization.createdByUser,
  updatedByUser: organization.updatedByUser,
  createdAt: organization.createdAt,
  updatedAt: organization.updatedAt,
  isDeleted: organization.isDeleted,
  deletedAt: organization.deletedAt,
  deletedByUser: organization.deletedByUser,
} as const;

const normalizeWebsiteDomain = (value: string) => {
  const trimmedValue = value.trim();
  const normalizedValue = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmedValue)
    ? trimmedValue
    : `https://${trimmedValue}`;

  try {
    return new URL(normalizedValue).hostname.toLowerCase();
  } catch {
    return trimmedValue.toLowerCase();
  }
};

export async function findCompanyById(id: string, options?: IncludeDeletedOptions) {
  const company = await db
    .select(companySelectColumns)
    .from(organization)
    .where(
      options?.includeDeleted
        ? eq(organization.id, id)
        : and(eq(organization.id, id), eq(organization.isDeleted, false))
    )
    .limit(1)
    .then((rows) => rows[0]);

  if (!company) {
    return null;
  }

  const roles = await db.query.rbacRole.findMany({
    where: eq(rbacRole.organizationId, id),
  });

  return {
    ...company,
    roles,
  };
}

const getAdminUserSummary = async (userId: string | null) => {
  if (!userId) {
    return null;
  }

  const adminUser = await db.query.user.findFirst({
    columns: {
      id: true,
      name: true,
      email: true,
      phoneNumber: true,
      emailVerified: true,
    },
    where: eq(user.id, userId),
  });

  return adminUser ?? null;
};

const getOrganizationMemberAuditUserId = async (
  organizationId: string,
  auditColumn: typeof member.createdByUser | typeof member.updatedByUser
) => {
  const memberAudit = await db
    .select({
      userId: auditColumn,
    })
    .from(member)
    .where(and(eq(member.organizationId, organizationId), eq(member.isDeleted, false)))
    .orderBy(asc(member.createdAt))
    .limit(1)
    .then((rows) => rows[0]);

  return memberAudit?.userId ?? null;
};

const getOrganizationMemberSummary = async (organizationId: string, ownerOnly: boolean) => {
  const memberSummary = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      phoneNumber: user.phoneNumber,
      emailVerified: user.emailVerified,
    })
    .from(member)
    .innerJoin(user, eq(user.id, member.userId))
    .where(
      and(
        eq(member.organizationId, organizationId),
        ownerOnly ? eq(member.role, "owner") : undefined,
        eq(member.isDeleted, false),
        eq(user.isDeleted, false)
      )
    )
    .orderBy(asc(member.createdAt))
    .limit(1)
    .then((rows) => rows[0]);

  return memberSummary ?? null;
};

const getOrganizationOwnerSummary = async (organizationId: string) => {
  const owner = await getOrganizationMemberSummary(organizationId, true);
  if (owner) {
    return owner;
  }

  return getOrganizationMemberSummary(organizationId, false);
};

const getCurrentOrganizationMember = async (organizationId: string, userId?: string | null) => {
  if (!userId) {
    return null;
  }

  const currentMember = await db
    .select({
      id: member.id,
      organizationId: member.organizationId,
      userId: member.userId,
      role: member.role,
      panel: member.panel,
      createdAt: member.createdAt,
      updatedAt: member.updatedAt,
      createdByUser: member.createdByUser,
      updatedByUser: member.updatedByUser,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phoneNumber: user.phoneNumber,
        emailVerified: user.emailVerified,
      },
    })
    .from(member)
    .innerJoin(user, eq(user.id, member.userId))
    .where(
      and(
        eq(member.organizationId, organizationId),
        eq(member.userId, userId),
        eq(member.isDeleted, false),
        eq(user.isDeleted, false)
      )
    )
    .limit(1)
    .then((rows) => rows[0]);

  return currentMember ?? null;
};

export async function findCompanySettingsById(id: string, currentUserId?: string | null) {
  const company = await db
    .select(companySelectColumns)
    .from(organization)
    .where(eq(organization.id, id))
    .limit(1)
    .then((rows) => rows[0]);

  if (!company) {
    return null;
  }

  const [memberCreatedByUser, memberUpdatedByUser] = await Promise.all([
    getOrganizationMemberAuditUserId(company.id, member.createdByUser),
    getOrganizationMemberAuditUserId(company.id, member.updatedByUser),
  ]);

  const [createdByUserAdmin, updatedByUserAdmin, ownerAdmin, currentMember] = await Promise.all([
    getAdminUserSummary(company.createdByUser ?? memberCreatedByUser),
    getAdminUserSummary(company.updatedByUser ?? memberUpdatedByUser),
    getOrganizationOwnerSummary(company.id),
    getCurrentOrganizationMember(company.id, currentUserId),
  ]);

  return {
    ...company,
    createdByUserAdmin: createdByUserAdmin ?? ownerAdmin,
    updatedByUserAdmin: updatedByUserAdmin ?? createdByUserAdmin ?? ownerAdmin,
    currentMember,
  };
}

export async function findNextCompanyId() {
  const latestCompany = await db
    .select({
      id: organization.id,
    })
    .from(organization)
    .orderBy(desc(organization.id))
    .limit(1)
    .then((rows) => rows[0]);

  return generateNextCompanyId(latestCompany?.id);
}

export async function findCompanyOwnerConflicts(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const [existingUser] = await db
    .select({
      id: user.id,
    })
    .from(user)
    .where(eq(sql`lower(${user.email})`, normalizedEmail))
    .limit(1);

  return {
    emailExists: Boolean(existingUser?.id),
  };
}

export async function findCompanyConflictBySlug(slug: string, excludeId?: string) {
  const normalizedSlug = slug.trim();

  return db.query.organization.findFirst({
    columns: {
      id: true,
    },
    where:
      excludeId != null
        ? and(eq(organization.slug, normalizedSlug), ne(organization.id, excludeId))
        : eq(organization.slug, normalizedSlug),
  });
}

export async function findCompanyConflictByWebsiteDomain(
  websiteDomain: string,
  excludeId?: string
) {
  const normalizedWebsiteDomain = normalizeWebsiteDomain(websiteDomain);
  const companies = await db
    .select({
      id: organization.id,
      websiteDomain: organization.websiteDomain,
    })
    .from(organization)
    .where(
      and(
        eq(organization.isDeleted, false),
        excludeId ? ne(organization.id, excludeId) : undefined,
        sql`${organization.websiteDomain} is not null`
      )
    );

  return (
    companies.find((company) => {
      if (!company.websiteDomain) {
        return false;
      }

      return normalizeWebsiteDomain(company.websiteDomain) === normalizedWebsiteDomain;
    }) ?? null
  );
}

export async function createCompanyAuthSeed(secret: string) {
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

async function findOwnerMemberByOrganizationId(organizationId: string) {
  return db
    .select({
      id: member.id,
      organizationId: member.organizationId,
      userId: member.userId,
      role: member.role,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phoneNumber: user.phoneNumber,
        emailVerified: user.emailVerified,
      },
    })
    .from(member)
    .innerJoin(user, eq(user.id, member.userId))
    .where(
      and(
        eq(member.organizationId, organizationId),
        eq(member.isDeleted, false),
        eq(user.isDeleted, false)
      )
    )
    .orderBy(asc(sql`case when ${member.role} = 'owner' then 0 else 1 end`), asc(member.createdAt))
    .limit(1)
    .then((rows) => rows[0]);
}

export async function getCompanyOwnerCredentialDeliveryData(id: string, secret: string) {
  const [companyData, ownerMember] = await Promise.all([
    findCompanyById(id),
    findOwnerMemberByOrganizationId(id),
  ]);

  if (!companyData) {
    return {
      success: false as const,
      message: "Company not found",
    };
  }

  if (!ownerMember) {
    return {
      success: false as const,
      message: "Company owner not found",
    };
  }

  const ownerAccount = await db
    .select({ id: account.id })
    .from(account)
    .where(and(eq(account.userId, ownerMember.userId), eq(account.providerId, "credential")))
    .limit(1)
    .then((rows) => rows[0]);

  if (!ownerAccount?.id) {
    return {
      success: false as const,
      message: "Company owner account not found",
    };
  }

  const password = decryptPassword(ownerAccount.id, secret);
  const hashedPassword = await PasswordUtils.hash(password);

  await db
    .update(account)
    .set({
      password: hashedPassword,
    })
    .where(eq(account.id, ownerAccount.id));

  return {
    success: true as const,
    data: {
      ownerName: ownerMember.user.name,
      email: ownerMember.user.email,
      password,
      organizationName: companyData.name,
    },
  };
}

export async function softDeleteCompanyById(
  id: string,
  currentUserId?: string | null,
  options?: {
    deleteRelated?: boolean;
  }
) {
  const deleteRelated = options?.deleteRelated ?? true;

  await db.transaction(async (tx) => {
    await tx
      .update(organization)
      .set({
        isDeleted: true,
        deletedAt: new Date(),
        deletedByUser: currentUserId ?? null,
        updatedByUser: currentUserId ?? null,
      })
      .where(eq(organization.id, id));

    if (!deleteRelated) {
      return;
    }

    await tx
      .update(member)
      .set({
        isDeleted: true,
        deletedAt: new Date(),
        deletedByUser: currentUserId ?? null,
        updatedByUser: currentUserId ?? null,
      })
      .where(eq(member.organizationId, id));
  });

  return findCompanyById(id, { includeDeleted: true });
}

export async function restoreCompanyById(
  id: string,
  currentUserId?: string | null,
  options?: {
    restoreRelated?: boolean;
  }
) {
  const restoreRelated = options?.restoreRelated ?? false;

  await db.transaction(async (tx) => {
    await tx
      .update(organization)
      .set({
        isDeleted: false,
        deletedAt: null,
        deletedByUser: null,
        updatedByUser: currentUserId ?? null,
      })
      .where(eq(organization.id, id));

    if (!restoreRelated) {
      return;
    }

    await tx
      .update(member)
      .set({
        isDeleted: false,
        deletedAt: null,
        deletedByUser: null,
        updatedByUser: currentUserId ?? null,
      })
      .where(eq(member.organizationId, id));
  });

  return findCompanyById(id);
}

export function logCredentialEmailFailure(scope: string, error: unknown) {
  logger.error(scope, { error });
}
