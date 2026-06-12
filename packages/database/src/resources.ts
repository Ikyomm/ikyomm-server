export const DATABASE_RESOURCES = {
  account: "account",
  app_user: "app_user",
  invitation: "invitation",
  member: "member",
  region: "region",
  music_playlists: "music_playlists",
  musics: "musics",
  pod_mood_presets: "pod_mood_presets",
  pods: "pods",
  organization: "organization",
  rbac_role: "rbac_role",
  rbac_role_permission: "rbac_role_permission",
  session: "session",
  user: "user",
  zone: "zone",
  zone_location: "zone_location",
} as const;

export type DatabaseResource = (typeof DATABASE_RESOURCES)[keyof typeof DATABASE_RESOURCES];

const DATABASE_RESOURCE_LIST = Object.freeze(
  Object.values(DATABASE_RESOURCES)
) as readonly DatabaseResource[];

export function getDatabaseResources(): readonly DatabaseResource[] {
  return DATABASE_RESOURCE_LIST;
}
