import { pgEnum } from "drizzle-orm/pg-core";

export const OrganizationType = pgEnum("organization_type", ["B2B", "CORPORATE"]);
export const PlatformMode = pgEnum("platform_mode", ["STANDARD", "WHITE_LABEL", "ENTERPRISE"]);
export const AccessPanel = pgEnum("access_panel", ["ommpods", "company", "ikyomm", "app"]);
export const PermissionAccessLevel = pgEnum("permission_access_level", ["company", "user", "all"]);

export type OrganizationType = (typeof OrganizationType.enumValues)[number];
export type PlatformMode = (typeof PlatformMode.enumValues)[number];
export type AccessPanel = (typeof AccessPanel.enumValues)[number];
export type PermissionAccessLevel = (typeof PermissionAccessLevel.enumValues)[number];
