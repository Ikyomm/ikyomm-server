import { relations } from "drizzle-orm";
import { createAuditRelationNames } from "../utils/audit";
import { account, invitation, member, organization, session, user } from "./schema";
import { rbacRole } from "./rbac/schema";
import { region, zone, zoneLocation } from "../location";
import { addresses } from "../treasure/addresses/schema";
import { orders } from "../treasure/orders/schema";
import { reviews } from "../treasure/reviews/schema";
import { subscriptions } from "../treasure/subscriptions/schema";

const memberUserRelationName = "memberUser";
const userCompanyRelationName = "userCompanyOrganization";

const auditRelations = {
  member: createAuditRelationNames("member"),
  organization: createAuditRelationNames("organization"),
  user: createAuditRelationNames("user"),
} as const;

export const userRelations = relations(user, ({ many, one }) => {
  const userAudit = (
    field: typeof user.createdByUser | typeof user.updatedByUser | typeof user.deletedByUser,
    relationName: (typeof auditRelations.user)[keyof typeof auditRelations.user]
  ) =>
    one(user, {
      fields: [field],
      references: [user.id],
      relationName,
    });

  return {
    accounts: many(account),
    account: many(account),
    sessions: many(session),
    session: many(session),
    members: many(member, {
      relationName: memberUserRelationName,
    }),
    companyOrganization: one(organization, {
      fields: [user.company],
      references: [organization.id],
      relationName: userCompanyRelationName,
    }),
    invitations: many(invitation),
    addresses: many(addresses),
    orders: many(orders),
    subscriptions: many(subscriptions),
    reviews: many(reviews),
    createdUsers: many(user, {
      relationName: auditRelations.user.created,
    }),
    updatedUsers: many(user, {
      relationName: auditRelations.user.updated,
    }),
    deletedUsers: many(user, {
      relationName: auditRelations.user.deleted,
    }),
    createdByUser: userAudit(user.createdByUser, auditRelations.user.created),
    updatedByUser: userAudit(user.updatedByUser, auditRelations.user.updated),
    deletedByUser: userAudit(user.deletedByUser, auditRelations.user.deleted),
    createdOrganizations: many(organization, {
      relationName: auditRelations.organization.created,
    }),
    updatedOrganizations: many(organization, {
      relationName: auditRelations.organization.updated,
    }),
    deletedOrganizations: many(organization, {
      relationName: auditRelations.organization.deleted,
    }),
    createdMembers: many(member, {
      relationName: auditRelations.member.created,
    }),
    updatedMembers: many(member, {
      relationName: auditRelations.member.updated,
    }),
    deletedMembers: many(member, {
      relationName: auditRelations.member.deleted,
    }),
  };
});

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
  activeOrganization: one(organization, {
    fields: [session.activeOrganizationId],
    references: [organization.id],
  }),
}));

export const organizationRelations = relations(organization, ({ many, one }) => {
  const organizationAudit = (
    field:
      | typeof organization.createdByUser
      | typeof organization.updatedByUser
      | typeof organization.deletedByUser,
    relationName: (typeof auditRelations.organization)[keyof typeof auditRelations.organization]
  ) =>
    one(user, {
      fields: [field],
      references: [user.id],
      relationName,
    });

  return {
    activeSessions: many(session),
    members: many(member),
    appUsers: many(user, {
      relationName: userCompanyRelationName,
    }),
    invitations: many(invitation),
    roles: many(rbacRole),
    createdByUser: organizationAudit(
      organization.createdByUser,
      auditRelations.organization.created
    ),
    updatedByUser: organizationAudit(
      organization.updatedByUser,
      auditRelations.organization.updated
    ),
    deletedByUser: organizationAudit(
      organization.deletedByUser,
      auditRelations.organization.deleted
    ),
  };
});

export const memberRelations = relations(member, ({ one }) => {
  const memberAudit = (
    field: typeof member.createdByUser | typeof member.updatedByUser | typeof member.deletedByUser,
    relationName: (typeof auditRelations.member)[keyof typeof auditRelations.member]
  ) =>
    one(user, {
      fields: [field],
      references: [user.id],
      relationName,
    });

  return {
    organization: one(organization, {
      fields: [member.organizationId],
      references: [organization.id],
    }),
    user: one(user, {
      fields: [member.userId],
      references: [user.id],
      relationName: memberUserRelationName,
    }),
    region: one(region, {
      fields: [member.regionId],
      references: [region.id],
    }),
    zone: one(zone, {
      fields: [member.zoneId],
      references: [zone.id],
    }),
    location: one(zoneLocation, {
      fields: [member.locationId],
      references: [zoneLocation.id],
    }),
    createdByUser: memberAudit(member.createdByUser, auditRelations.member.created),
    updatedByUser: memberAudit(member.updatedByUser, auditRelations.member.updated),
    deletedByUser: memberAudit(member.deletedByUser, auditRelations.member.deleted),
  };
});

export const invitationRelations = relations(invitation, ({ one }) => ({
  organization: one(organization, {
    fields: [invitation.organizationId],
    references: [organization.id],
  }),
  user: one(user, {
    fields: [invitation.inviterId],
    references: [user.id],
  }),
}));
