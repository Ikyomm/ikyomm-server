import {
  account,
  db,
  member,
  organization,
  region,
  user,
  zone,
  zoneLocation,
} from "@ikyomm/database";
import {
  decryptPassword,
  encryptPassword,
  generateRandomPassword,
  generateUID,
  PasswordUtils,
} from "@ikyomm/utils";
import { and, eq, sql } from "drizzle-orm";

type IncludeDeletedOptions = {
  includeDeleted?: boolean;
};

export async function findMemberDetailsById(id: string) {
  return db
    .select({
      id: member.id,
      organizationId: member.organizationId,
      userId: member.userId,
      role: member.role,
      panel: member.panel,
      regionId: member.regionId,
      zoneId: member.zoneId,
      locationId: member.locationId,
      createdAt: member.createdAt,
      updatedAt: member.updatedAt,
      createdByUser: member.createdByUser,
      updatedByUser: member.updatedByUser,
      deletedAt: member.deletedAt,
      isDeleted: member.isDeleted,
      deletedByUser: member.deletedByUser,
      user,
    })
    .from(member)
    .innerJoin(user, eq(user.id, member.userId))
    .where(and(eq(member.id, id), eq(member.isDeleted, false), eq(user.isDeleted, false)))
    .limit(1)
    .then((rows) => rows[0]);
}

export async function validateMemberLocationAssignment(input: {
  regionId?: string | null;
  zoneId?: string | null;
  locationId?: string | null;
}) {
  const [regionData, zoneData, locationData] = await Promise.all([
    input.regionId
      ? db
          .select({ id: region.id })
          .from(region)
          .where(and(eq(region.id, input.regionId), eq(region.isDeleted, false)))
          .limit(1)
          .then((rows) => rows[0])
      : null,
    input.zoneId
      ? db
          .select({ id: zone.id, regionId: zone.regionId })
          .from(zone)
          .where(and(eq(zone.id, input.zoneId), eq(zone.isDeleted, false)))
          .limit(1)
          .then((rows) => rows[0])
      : null,
    input.locationId
      ? db
          .select({ id: zoneLocation.id, zoneId: zoneLocation.zoneId })
          .from(zoneLocation)
          .where(and(eq(zoneLocation.id, input.locationId), eq(zoneLocation.isDeleted, false)))
          .limit(1)
          .then((rows) => rows[0])
      : null,
  ]);

  if (input.regionId && !regionData) {
    return { valid: false as const, message: "Region not found" };
  }

  if (input.zoneId && !zoneData) {
    return { valid: false as const, message: "Zone not found" };
  }

  if (input.locationId && !locationData) {
    return { valid: false as const, message: "Location not found" };
  }

  if (regionData && zoneData && zoneData.regionId !== regionData.id) {
    return { valid: false as const, message: "Zone does not belong to the selected region" };
  }

  if (zoneData && locationData && locationData.zoneId !== zoneData.id) {
    return { valid: false as const, message: "Location does not belong to the selected zone" };
  }

  return { valid: true as const };
}

export async function findMemberById(id: string, options?: IncludeDeletedOptions) {
  const whereClause = options?.includeDeleted
    ? eq(member.id, id)
    : and(eq(member.id, id), eq(member.isDeleted, false));

  return db
    .select()
    .from(member)
    .where(whereClause)
    .limit(1)
    .then((rows) => rows[0]);
}

export async function findMemberConflictByEmail(email: string, organizationId: string) {
  const normalizedEmail = email.trim().toLowerCase();

  return db
    .select({
      userId: user.id,
      memberId: member.id,
      organizationId: member.organizationId,
    })
    .from(user)
    .leftJoin(
      member,
      and(
        eq(member.userId, user.id),
        eq(member.organizationId, organizationId),
        eq(member.isDeleted, false)
      )
    )
    .where(eq(sql`lower(${user.email})`, normalizedEmail))
    .limit(1)
    .then((rows) => rows[0]);
}

export async function findOrganizationSummaryById(id: string) {
  return db
    .select({
      id: organization.id,
      name: organization.name,
      type: organization.type,
    })
    .from(organization)
    .where(and(eq(organization.id, id), eq(organization.isDeleted, false)))
    .limit(1)
    .then((rows) => rows[0]);
}

export async function createMemberAuthSeed(secret: string, passwordInput?: string | null) {
  const password = passwordInput?.trim() || generateRandomPassword();
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

export async function getMemberCredentialDeliveryData(id: string, secret: string) {
  const memberData = await findMemberDetailsById(id);

  if (!memberData) {
    return {
      success: false as const,
      message: "Member not found",
    };
  }

  const [orgData, memberAccount] = await Promise.all([
    findOrganizationSummaryById(memberData.organizationId),
    db
      .select({ id: account.id })
      .from(account)
      .where(and(eq(account.userId, memberData.userId), eq(account.providerId, "credential")))
      .limit(1)
      .then((rows) => rows[0]),
  ]);

  if (!orgData) {
    return {
      success: false as const,
      message: "Company not found",
    };
  }

  if (!memberAccount?.id) {
    return {
      success: false as const,
      message: "Member account not found",
    };
  }

  const password = decryptPassword(memberAccount.id, secret);
  const hashedPassword = await PasswordUtils.hash(password);

  await db
    .update(account)
    .set({
      password: hashedPassword,
    })
    .where(eq(account.id, memberAccount.id));

  return {
    success: true as const,
    data: {
      email: memberData.user.email,
      password,
      organizationName: orgData.name,
      role: memberData.role,
    },
  };
}
