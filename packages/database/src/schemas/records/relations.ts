import { relations } from "drizzle-orm";
import { organization, user } from "../auth";
import { zoneLocation } from "../location";
import { ikyommWallet, organizationWallet, userWallet, walletTransactions } from "../wallets";
import { podSessionLogs, podSessions } from "../sessions";
import { aromaDefusers } from "./devices/aroma-defusers";
import { musicPlaylists, musics } from "./musics";
import { pods } from "./pods";

export const podRelations = relations(pods, ({ one }) => ({
  location: one(zoneLocation, {
    fields: [pods.locationId],
    references: [zoneLocation.id],
  }),
  aromaDefuser: one(aromaDefusers, {
    fields: [pods.aromaDefuserId],
    references: [aromaDefusers.id],
  }),
}));

export const aromaDefuserRelations = relations(aromaDefusers, ({ many }) => ({
  pods: many(pods),
}));

export const podSessionRelations = relations(podSessions, ({ many, one }) => ({
  pod: one(pods, {
    fields: [podSessions.podId],
    references: [pods.id],
  }),
  user: one(user, {
    fields: [podSessions.userId],
    references: [user.id],
  }),
  organization: one(organization, {
    fields: [podSessions.companyId],
    references: [organization.id],
  }),
  logs: many(podSessionLogs),
}));

export const podSessionLogRelations = relations(podSessionLogs, ({ one }) => ({
  session: one(podSessions, {
    fields: [podSessionLogs.sessionId],
    references: [podSessions.id],
  }),
}));

export const musicPlaylistRelations = relations(musicPlaylists, ({ many }) => ({
  musics: many(musics),
}));

export const musicRelations = relations(musics, ({ one }) => ({
  playlist: one(musicPlaylists, {
    fields: [musics.playlistId],
    references: [musicPlaylists.id],
  }),
}));

export const userWalletRelations = relations(userWallet, ({ many, one }) => ({
  user: one(user, {
    fields: [userWallet.userId],
    references: [user.id],
  }),
  outgoingTransactions: many(walletTransactions, {
    relationName: "walletTransactionsFromUserWallet",
  }),
  incomingTransactions: many(walletTransactions, {
    relationName: "walletTransactionsToUserWallet",
  }),
}));

export const organizationWalletRelations = relations(organizationWallet, ({ many, one }) => ({
  organization: one(organization, {
    fields: [organizationWallet.organizationId],
    references: [organization.id],
  }),
  outgoingTransactions: many(walletTransactions, {
    relationName: "walletTransactionsFromOrganizationWallet",
  }),
  incomingTransactions: many(walletTransactions, {
    relationName: "walletTransactionsToOrganizationWallet",
  }),
}));

export const ikyommWalletRelations = relations(ikyommWallet, ({ many }) => ({
  outgoingTransactions: many(walletTransactions, {
    relationName: "walletTransactionsFromIkyommWallet",
  }),
  incomingTransactions: many(walletTransactions, {
    relationName: "walletTransactionsToIkyommWallet",
  }),
}));

export const walletTransactionRelations = relations(walletTransactions, ({ one }) => ({
  fromUserWallet: one(userWallet, {
    fields: [walletTransactions.fromUserWalletId],
    references: [userWallet.id],
    relationName: "walletTransactionsFromUserWallet",
  }),
  fromOrganizationWallet: one(organizationWallet, {
    fields: [walletTransactions.fromOrganizationWalletId],
    references: [organizationWallet.id],
    relationName: "walletTransactionsFromOrganizationWallet",
  }),
  fromIkyommWallet: one(ikyommWallet, {
    fields: [walletTransactions.fromIkyommWalletId],
    references: [ikyommWallet.id],
    relationName: "walletTransactionsFromIkyommWallet",
  }),
  toUserWallet: one(userWallet, {
    fields: [walletTransactions.toUserWalletId],
    references: [userWallet.id],
    relationName: "walletTransactionsToUserWallet",
  }),
  toOrganizationWallet: one(organizationWallet, {
    fields: [walletTransactions.toOrganizationWalletId],
    references: [organizationWallet.id],
    relationName: "walletTransactionsToOrganizationWallet",
  }),
  toIkyommWallet: one(ikyommWallet, {
    fields: [walletTransactions.toIkyommWalletId],
    references: [ikyommWallet.id],
    relationName: "walletTransactionsToIkyommWallet",
  }),
}));
