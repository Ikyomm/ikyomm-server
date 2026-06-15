import { member, organization, OrganizationType, PlatformMode, rbacRole } from "@ikyomm/database";
import {
  createDbInsertSchema,
  createDbSelectSchema,
  createDbUpdateSchema,
  createListQuerySchema,
  createListResponseSchema,
  optionalBooleanQuerySchema,
} from "@ikyomm/utils";
import { z } from "@hono/zod-openapi";

const isValidDomainLabel = (value: string): boolean =>
  /^[a-z0-9-]{1,63}$/i.test(value) && !value.startsWith("-") && !value.endsWith("-");

const isValidDomainHostname = (value: string): boolean => {
  if (value.length > 253) {
    return false;
  }

  const labels = value.split(".");
  if (labels.length < 2) {
    return false;
  }

  const topLevelDomain = labels[labels.length - 1];
  if (!topLevelDomain || !/^[a-z]{2,63}$/i.test(topLevelDomain)) {
    return false;
  }

  return labels.every(isValidDomainLabel);
};

const isValidWebsiteDomainValue = (value: string): boolean => {
  if (value.includes(" ")) {
    return false;
  }

  const normalized = /^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `https://${value}`;

  try {
    const parsed = new URL(normalized);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return false;
    }

    return isValidDomainHostname(parsed.hostname);
  } catch {
    return false;
  }
};

const websiteDomainSchema = z.string().trim().refine(isValidWebsiteDomainValue, {
  message:
    "Invalid website domain. Use formats like xconics.com, www.xconics.com, or https://xconics.com",
});

export const companyWebsiteDomainAvailabilityQuerySchema = z.object({
  websiteDomain: websiteDomainSchema,
  excludeId: z.string().trim().optional(),
});

export const companyWebsiteDomainAvailabilitySchema = z.object({
  status: z.boolean(),
});

export const companySchema = createDbSelectSchema(organization).extend({
  roles: z.array(
    createDbSelectSchema(rbacRole, {
      omit: ["organizationId"],
    })
  ),
});

const companyUserSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.email(),
  phoneNumber: z.string().nullable(),
  emailVerified: z.boolean(),
});

const companyAdminUserSummarySchema = companyUserSummarySchema.nullable();

const companyCurrentMemberSchema = createDbSelectSchema(member, {
  omit: ["deletedAt", "isDeleted", "deletedByUser"],
})
  .extend({
    user: companyUserSummarySchema,
  })
  .nullable();

export const companySettingsSchema = createDbSelectSchema(organization).extend({
  createdByUserAdmin: companyAdminUserSummarySchema,
  updatedByUserAdmin: companyAdminUserSummarySchema,
  currentMember: companyCurrentMemberSchema,
});

export const companyCreateSchema = createDbInsertSchema(organization, {
  omit: [
    "id",
    "createdAt",
    "updatedAt",
    "deletedAt",
    "isDeleted",
    "createdByUser",
    "updatedByUser",
    "deletedByUser",
  ],
  customizeSchema(schema) {
    return schema.extend({
      ownerName: z.string().min(1, "Owner name is required"),
      ownerEmail: z.email("Invalid email address"),
      password: z.preprocess(
        (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
        z.string().trim().min(8, "Password must be at least 8 characters").optional()
      ),
      ownerPhoneNumber: z.string().optional(),
      initialCreditMinute: z.coerce.number().nonnegative().optional(),
      websiteDomain: websiteDomainSchema.nullish(),
    });
  },
});

export const COMPANY_CREATION_STEPS = [
  "validate_input",
  "insert_user",
  "insert_credential_account",
  "insert_organization",
  "insert_organization_wallet",
  "transfer_initial_credits",
  "insert_member",
] as const;

export type CompanyCreationStep = (typeof COMPANY_CREATION_STEPS)[number];

export const companyCreateResponseSchema = z.object({
  company: companySchema,
  owner: z.object({
    id: z.string(),
    name: z.string(),
    email: z.email(),
    emailVerified: z.boolean(),
    phoneNumber: z.string().nullable(),
  }),
  completedSteps: z.number(),
  totalSteps: z.number(),
  stepsCompleted: z.array(z.enum(COMPANY_CREATION_STEPS)),
  stepsFailed: z.array(z.enum(COMPANY_CREATION_STEPS)),
});

export const companyPermanentDeleteResultSchema = z.object({
  message: z.string(),
});

export const companyUpdateSchema = createDbUpdateSchema(organization, {
  omit: [
    "id",
    "slug",
    "createdAt",
    "updatedAt",
    "deletedAt",
    "isDeleted",
    "deletedByUser",
    "createdByUser",
    "updatedByUser",
  ],
  customizeSchema(schema) {
    return schema.extend({
      websiteDomain: websiteDomainSchema.nullable().optional(),
    });
  },
});

const companyOwnerSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.email(),
  emailVerified: z.boolean(),
  phoneNumber: z.string().nullable(),
});

export const companyListItemSchema = createDbSelectSchema(organization).extend({
  owner: companyOwnerSummarySchema.nullable(),
  memberCount: z.number(),
});

export const companyActionMessageSchema = z.object({
  message: z.string(),
});

export const companyListSortFields = [
  "id",
  "name",
  "email",
  "phoneNumber",
  "isActive",
  "createdAt",
  "updatedAt",
] as const;

export const companyListQuerySchema = createListQuerySchema({
  sortFields: companyListSortFields,
  extraShape: {
    isDeleted: optionalBooleanQuerySchema,
    isActive: optionalBooleanQuerySchema,
    type: z.enum(OrganizationType.enumValues).optional(),
    platformMode: z.enum(PlatformMode.enumValues).optional(),
  },
});

export type CompanyListQuery = z.infer<typeof companyListQuerySchema>;

export const companyListResponseSchema = createListResponseSchema(companyListItemSchema);
