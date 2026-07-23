import { organization, session, user, userWallet } from "@ikyomm/database";
import {
  createDbSelectSchema,
  createListQuerySchema,
  createListResponseSchema,
  IdStringParamSchema,
  optionalBooleanQuerySchema,
} from "@ikyomm/utils";
import { z } from "@hono/zod-openapi";

const appUserOrganizationSchema = createDbSelectSchema(organization).pick({
  id: true,
  name: true,
  slug: true,
  type: true,
  isActive: true,
});

const appUserWalletSchema = createDbSelectSchema(userWallet).pick({
  id: true,
  userId: true,
  creditMinute: true,
});

export const ommpodsAgentUserSchema = createDbSelectSchema(user).extend({
  organization: appUserOrganizationSchema.nullable().optional(),
  wallet: appUserWalletSchema.nullable().optional(),
});

const agentUserMutableFields = {
  name: z.string().min(1, "Name is required"),
  email: z.email("Invalid email address"),
  password: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().min(8, "Password must be at least 8 characters").optional()
  ),
  role: z.string().min(1, "Role is required"),
  image: z.url("Invalid URL").nullish(),
  phoneNumber: z.string().nullish(),
  country: z.string().nullish(),
  state: z.string().nullish(),
  city: z.string().nullish(),
  employeeId: z.string().nullish(),
  employeeEmail: z.email("Invalid employee email address").nullish(),
  company: z.string().nullish(),
  creditMinute: z.coerce.number().positive("Credit minutes must be greater than 0").optional(),
  banned: z.boolean().optional(),
  banReason: z.string().nullish(),
  banExpires: z.coerce.date().nullish(),
};

export const ommpodsAgentUserCreateSchema = z.object({
  ...agentUserMutableFields,
  role: agentUserMutableFields.role.optional(),
});

export const ommpodsAgentUserUpdateSchema = z.object({
  name: agentUserMutableFields.name.optional(),
  email: agentUserMutableFields.email.optional(),
  role: agentUserMutableFields.role.optional(),
  image: agentUserMutableFields.image,
  phoneNumber: agentUserMutableFields.phoneNumber,
  country: agentUserMutableFields.country,
  state: agentUserMutableFields.state,
  city: agentUserMutableFields.city,
  employeeId: agentUserMutableFields.employeeId,
  employeeEmail: agentUserMutableFields.employeeEmail,
  company: agentUserMutableFields.company,
  banned: agentUserMutableFields.banned,
  banReason: agentUserMutableFields.banReason,
  banExpires: agentUserMutableFields.banExpires,
});

export const ommpodsAgentUserListQuerySchema = createListQuerySchema({
  sortFields: ["name", "email", "role", "phoneNumber", "createdAt", "updatedAt"],
  extraShape: {
    role: z.string().optional(),
    company: z.string().optional(),
    companyAssigned: optionalBooleanQuerySchema,
    emailVerified: optionalBooleanQuerySchema,
    banned: optionalBooleanQuerySchema,
    isDeleted: optionalBooleanQuerySchema,
  },
});

export type OmmpodsAgentUserListQuery = z.infer<typeof ommpodsAgentUserListQuerySchema>;
export type ScopedOmmpodsAgentUserListQuery = OmmpodsAgentUserListQuery & {
  excludeUserId?: string;
};

export const ommpodsAgentUserListResponseSchema = createListResponseSchema(ommpodsAgentUserSchema);

export const ommpodsAgentUserPermanentDeleteResultSchema = z.object({
  message: z.string(),
});

export const ommpodsAgentUserSessionSchema = createDbSelectSchema(session);
export const ommpodsAgentUserSessionListSchema = z.array(ommpodsAgentUserSessionSchema);
export const ommpodsAgentUserSessionParamsSchema = IdStringParamSchema();
export const ommpodsAgentUserSessionTokenParamsSchema = z.object({
  id: z.string().min(1),
  sessionToken: z.string().min(1),
});
export const ommpodsAgentUserSessionRevokeResultSchema = z.object({
  message: z.string(),
});
