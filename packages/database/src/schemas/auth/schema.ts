import {
  type AnyPgColumn,
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { AccessPanel, PlatformMode, OrganizationType } from "./enums";
import { referenceColumns } from "../reference-columns";
import { region, zone, zoneLocation } from "../location";

export type UserMetadata = {
  age?: number | null;
  gender?: "male" | "female" | "dont_disclose" | null;
};

export const user = pgTable(
  "user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").default(false).notNull(),

    // location details
    country: text("country"),
    state: text("state"),
    city: text("city"),
    address: text("address"),

    // Corporate Details
    company: text("company").references((): AnyPgColumn => organization.id, {
      onDelete: "set null",
    }),
    employeeId: text("employee_id"),
    employeeEmail: text("employee_email"),

    // For Profile
    image: text("image"),
    role: text("role").default("user").notNull(),
    panel: AccessPanel("panel").default("ikyomm").notNull(),
    metadata: jsonb("metadata").$type<UserMetadata>(),
    banned: boolean("banned").default(false),
    banReason: text("ban_reason"),
    banExpires: timestamp("ban_expires"),
    phoneNumber: text("phone_number"),
    phoneNumberVerified: boolean("phone_number_verified").default(false),
    ...referenceColumns((): AnyPgColumn => user.id),
  },
  (table) => [
    index("user_name_idx").on(table.name),
    index("user_role_idx").on(table.role),
    index("user_panel_idx").on(table.panel),
    index("user_emailVerified_idx").on(table.emailVerified),
    index("user_banned_idx").on(table.banned),
    index("user_phoneNumberVerified_idx").on(table.phoneNumberVerified),
    index("user_country_idx").on(table.country),
    index("user_state_idx").on(table.state),
    index("user_city_idx").on(table.city),
    index("user_company_idx").on(table.company),
    index("user_employeeEmail_idx").on(table.employeeEmail),
  ]
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references((): AnyPgColumn => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("account_userId_idx").on(table.userId)]
);

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references((): AnyPgColumn => user.id, { onDelete: "cascade" }),
    activeOrganizationId: text("active_organization_id").references(
      (): AnyPgColumn => organization.id,
      {
        onDelete: "set null",
      }
    ),
    impersonatedBy: text("impersonated_by"),
  },
  (table) => [
    uniqueIndex("session_token_uidx").on(table.token),
    index("session_userId_idx").on(table.userId),
    index("session_activeOrganizationId_idx").on(table.activeOrganizationId),
    index("session_expiresAt_idx").on(table.expiresAt),
  ]
);

export const organization = pgTable(
  "organization",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    logo: text("logo"),
    type: OrganizationType("type").notNull(),
    platformMode: PlatformMode("platform_mode").default("STANDARD"),
    metadata: text("metadata"),

    // location details
    country: text("country"),
    state: text("state"),
    city: text("city"),
    address: text("address"),

    // Org Contact Details
    email: text("email"),
    phoneNumber: text("phone_number"),
    websiteDomain: text("website_domain"),
    isActive: boolean("is_active").default(false).notNull(),

    ...referenceColumns((): AnyPgColumn => user.id),
  },
  (table) => [
    uniqueIndex("organization_slug_uidx").on(table.slug),
    index("organization_isDeleted_createdAt_idx").on(table.isDeleted, table.createdAt),
    index("organization_isDeleted_updatedAt_idx").on(table.isDeleted, table.updatedAt),
    index("organization_isDeleted_name_idx").on(table.isDeleted, table.name),
    index("organization_isDeleted_type_idx").on(table.isDeleted, table.type),
    index("organization_isDeleted_isActive_idx").on(table.isDeleted, table.isActive),
    index("organization_email_idx").on(table.email),
    index("organization_phoneNumber_idx").on(table.phoneNumber),
    index("organization_websiteDomain_idx").on(table.websiteDomain),
    index("organization_country_idx").on(table.country),
    index("organization_state_idx").on(table.state),
    index("organization_city_idx").on(table.city),
  ]
);

export const member = pgTable(
  "member",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references((): AnyPgColumn => organization.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references((): AnyPgColumn => user.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    panel: AccessPanel("panel").default("company").notNull(),
    regionId: text("region_id").references((): AnyPgColumn => region.id, {
      onDelete: "set null",
    }),
    zoneId: text("zone_id").references((): AnyPgColumn => zone.id, { onDelete: "set null" }),
    locationId: text("location_id").references((): AnyPgColumn => zoneLocation.id, {
      onDelete: "set null",
    }),
    ...referenceColumns((): AnyPgColumn => user.id),
  },
  (table) => [
    index("member_organizationId_idx").on(table.organizationId),
    index("member_userId_idx").on(table.userId),
    index("member_panel_idx").on(table.panel),
    index("member_regionId_idx").on(table.regionId),
    index("member_zoneId_idx").on(table.zoneId),
    index("member_locationId_idx").on(table.locationId),
    index("member_organizationId_role_idx").on(table.organizationId, table.role),
    index("member_organizationId_isDeleted_userId_idx").on(
      table.organizationId,
      table.isDeleted,
      table.userId
    ),
    index("member_organizationId_isDeleted_role_idx").on(
      table.organizationId,
      table.isDeleted,
      table.role
    ),
  ]
);

export const invitation = pgTable(
  "invitation",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references((): AnyPgColumn => organization.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: text("role").notNull(),
    status: text("status").default("pending").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    inviterId: text("inviter_id")
      .notNull()
      .references((): AnyPgColumn => user.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("invitation_organizationId_idx").on(table.organizationId),
    index("invitation_email_idx").on(table.email),
  ]
);
