import { getTableColumns, getTableName, type Table } from "drizzle-orm";
import {
  account,
  aromaDefusers,
  ikyommWallet,
  invitation,
  member,
  musicPlaylists,
  musics,
  organization,
  organizationWallet,
  podMoodPresets,
  podSessionLogs,
  podSessions,
  pods,
  region,
  rbacRole,
  rbacRolePermission,
  session,
  user,
  userWallet,
  walletTransactions,
  zone,
  zoneLocation,
} from "./schemas";
import { DATABASE_RESOURCES, type DatabaseResource } from "./resources";

export type RbacResourceScope = "ikyomm" | "company" | "app";

const DEFAULT_RESOURCE_ACTIONS = ["get", "getAll", "create", "update", "delete"] as const;

const ACTIONS: Partial<Record<DatabaseResource, readonly string[]>> = {
  app_user: [...DEFAULT_RESOURCE_ACTIONS, "activate", "deactivate", "restore"],
  member: [...DEFAULT_RESOURCE_ACTIONS, "activate", "deactivate"],
  organization: [...DEFAULT_RESOURCE_ACTIONS, "activate", "restore"],
  music_playlists: [...DEFAULT_RESOURCE_ACTIONS, "restore"],
  musics: [...DEFAULT_RESOURCE_ACTIONS, "restore"],
  ikyomm_wallet: [...DEFAULT_RESOURCE_ACTIONS, "restore", "addCredits"],
  organization_wallet: [...DEFAULT_RESOURCE_ACTIONS, "restore", "addCredits"],
  pod_mood_presets: [...DEFAULT_RESOURCE_ACTIONS, "restore"],
  pod_session_logs: [...DEFAULT_RESOURCE_ACTIONS],
  pod_sessions: [...DEFAULT_RESOURCE_ACTIONS, "restore"],
  pods: [...DEFAULT_RESOURCE_ACTIONS, "restore"],
  aroma_defuser: [...DEFAULT_RESOURCE_ACTIONS, "restore"],
  region: [...DEFAULT_RESOURCE_ACTIONS, "restore"],
  user: [...DEFAULT_RESOURCE_ACTIONS, "activate", "deactivate", "restore"],
  user_wallet: [...DEFAULT_RESOURCE_ACTIONS, "restore", "addCredits"],
  wallet_transactions: [...DEFAULT_RESOURCE_ACTIONS, "restore"],
  zone: [...DEFAULT_RESOURCE_ACTIONS, "restore"],
  zone_location: [...DEFAULT_RESOURCE_ACTIONS, "restore"],
};

const COMPANY_RESOURCES = new Set<DatabaseResource>([
  DATABASE_RESOURCES.account,
  DATABASE_RESOURCES.invitation,
  DATABASE_RESOURCES.member,
  DATABASE_RESOURCES.organization_wallet,
  DATABASE_RESOURCES.rbac_role,
  DATABASE_RESOURCES.rbac_role_permission,
  DATABASE_RESOURCES.session,
  DATABASE_RESOURCES.user,
  DATABASE_RESOURCES.user_wallet,
  DATABASE_RESOURCES.wallet_transactions,
]);

const APP_RESOURCES = new Set<DatabaseResource>([
  DATABASE_RESOURCES.account,
  DATABASE_RESOURCES.app_user,
  DATABASE_RESOURCES.session,
  DATABASE_RESOURCES.user,
]);

const RESOURCE_TABLES = {
  account,
  app_user: user,
  aroma_defuser: aromaDefusers,
  invitation,
  member,
  music_playlists: musicPlaylists,
  musics,
  ikyomm_wallet: ikyommWallet,
  organization,
  organization_wallet: organizationWallet,
  pod_mood_presets: podMoodPresets,
  pod_session_logs: podSessionLogs,
  pod_sessions: podSessions,
  pods,
  region,
  rbac_role: rbacRole,
  rbac_role_permission: rbacRolePermission,
  session,
  user,
  user_wallet: userWallet,
  wallet_transactions: walletTransactions,
  zone,
  zone_location: zoneLocation,
} as const satisfies Record<DatabaseResource, Table>;

const toLabel = (resource: string) =>
  resource
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const getScopes = (resource: DatabaseResource): RbacResourceScope[] => {
  if (APP_RESOURCES.has(resource)) {
    return ["ikyomm", "company", "app"];
  }

  return COMPANY_RESOURCES.has(resource) ? ["ikyomm", "company"] : ["ikyomm"];
};

const getColumns = (table: Table) =>
  Object.entries(getTableColumns(table)).map(([key, column]) => ({
    key,
    name: column.name,
    dataType: column.dataType,
    columnType: column.columnType,
    notNull: column.notNull,
    hasDefault: column.hasDefault,
    enumValues: column.enumValues ?? [],
  }));

const RESOURCES = Object.freeze(
  Object.entries(RESOURCE_TABLES).map(([resource, table]) => ({
    resource: resource as DatabaseResource,
    tableName: getTableName(table),
    label: toLabel(resource),
    scopes: getScopes(resource as DatabaseResource),
    actions: ACTIONS[resource as DatabaseResource] ?? DEFAULT_RESOURCE_ACTIONS,
    columns: getColumns(table),
  }))
);

export function getRbacResourceMetadata(scope: RbacResourceScope) {
  return RESOURCES.filter((resource) => resource.scopes.includes(scope));
}
