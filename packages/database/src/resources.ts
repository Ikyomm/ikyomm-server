export const DATABASE_RESOURCES = {
  account: "account",
  aroma_defuser: "aroma_defuser",
  app_user: "app_user",
  invitation: "invitation",
  member: "member",
  region: "region",
  music_playlists: "music_playlists",
  musics: "musics",
  pod_mood_presets: "pod_mood_presets",
  pods: "pods",
  pod_sessions: "pod_sessions",
  pod_session_logs: "pod_session_logs",
  ikyomm_wallet: "ikyomm_wallet",
  organization: "organization",
  organization_wallet: "organization_wallet",
  rbac_role: "rbac_role",
  rbac_role_permission: "rbac_role_permission",
  session: "session",
  treasure_addresses: "treasure_addresses",
  treasure_brands: "treasure_brands",
  treasure_categories: "treasure_categories",
  treasure_inventory: "treasure_inventory",
  treasure_order_items: "treasure_order_items",
  treasure_orders: "treasure_orders",
  treasure_payments: "treasure_payments",
  treasure_product_collections: "treasure_product_collections",
  treasure_product_variants: "treasure_product_variants",
  treasure_products: "treasure_products",
  treasure_reviews: "treasure_reviews",
  treasure_subcategories: "treasure_subcategories",
  treasure_subscriptions: "treasure_subscriptions",
  treasure_warehouses: "treasure_warehouses",
  user: "user",
  user_wallet: "user_wallet",
  wallet_transactions: "wallet_transactions",
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
