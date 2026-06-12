/** biome-ignore-all lint/suspicious/noExplicitAny: Drizzle query builders are intentionally passed through reusable helpers. */
import { db, getDB, member, organization, user } from "@ikyomm/database";
import { createTableListFetcher } from "@ikyomm/utils";
import { and, count, eq, inArray } from "drizzle-orm";
import type { CompanyListQuery } from "./schema";

type CompanyOwnerSummary = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  phoneNumber: unknown;
};

type CompanyListBase = Record<string, unknown> & {
  id: string;
  owner: CompanyOwnerSummary | null;
};

function normalizePlatformMode(value: unknown) {
  if (value === "WHITELABEL") {
    return "WHITE_LABEL";
  }

  if (value === "GENERAL") {
    return "STANDARD";
  }

  return value;
}

function companyListJoins(queryBuilder: any) {
  return queryBuilder
    .leftJoin(
      member,
      and(
        eq(member.organizationId, organization.id),
        eq(member.role, "owner"),
        eq(member.isDeleted, false)
      )
    )
    .leftJoin(user, eq(user.id, member.userId));
}

function mapCompanyListItem(row: Record<string, unknown>) {
  const { ownerId, ownerName, ownerEmail, ownerPhoneNumber, ownerEmailVerified, ...company } = row;

  return {
    ...(company as Record<string, unknown> & { id: string }),
    platformMode: normalizePlatformMode(company.platformMode),
    owner:
      ownerId && ownerName && ownerEmail
        ? {
            id: String(ownerId),
            name: String(ownerName),
            email: String(ownerEmail),
            emailVerified: Boolean(ownerEmailVerified),
            phoneNumber: ownerPhoneNumber ?? null,
          }
        : null,
  } satisfies CompanyListBase;
}

const fetchCompanyBaseList = createTableListFetcher<
  typeof organization,
  ReturnType<typeof mapCompanyListItem>,
  CompanyListQuery
>({
  db: getDB,
  table: organization,
  select: () => ({
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
    ownerId: user.id,
    ownerName: user.name,
    ownerEmail: user.email,
    ownerPhoneNumber: user.phoneNumber,
    ownerEmailVerified: user.emailVerified,
  }),
  joins: companyListJoins,
  where: ({ params }) => eq(organization.isDeleted, params.isDeleted ?? false),
  search: {
    exact: [organization.id],
    prefix: [organization.slug, organization.email, organization.phoneNumber, user.email],
    contains: [organization.name, user.name],
  },
  filterColumns: {
    isActive: organization.isActive,
    type: organization.type,
    platformMode: organization.platformMode,
  },
  sorting: { defaultBy: "createdAt", defaultOrder: "desc" },
  sortColumns: {
    id: organization.id,
    name: organization.name,
    email: organization.email,
    phoneNumber: organization.phoneNumber,
    isActive: organization.isActive,
    createdAt: organization.createdAt,
    updatedAt: organization.updatedAt,
  },
  mapItem: mapCompanyListItem,
  counts: {
    totalJoins: companyListJoins,
  },
});

async function attachCompanyListMetrics(items: ReturnType<typeof mapCompanyListItem>[]) {
  if (items.length === 0) {
    return [];
  }

  const organizationIds = items.map((item) => item.id);
  const memberCountRows = await db
    .select({
      organizationId: member.organizationId,
      memberCount: count(member.id),
    })
    .from(member)
    .where(and(inArray(member.organizationId, organizationIds), eq(member.isDeleted, false)))
    .groupBy(member.organizationId);

  const memberCountByOrganizationId = new Map(
    memberCountRows.map((row) => [row.organizationId, Number(row.memberCount)])
  );

  return items.map((item) => ({
    ...item,
    memberCount: memberCountByOrganizationId.get(item.id) ?? 0,
  }));
}

export async function fetchCompanyList(query: CompanyListQuery) {
  const response = await fetchCompanyBaseList(query);

  return {
    ...response,
    items: await attachCompanyListMetrics(response.items),
  };
}
