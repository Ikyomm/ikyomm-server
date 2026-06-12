import { organization, session, user } from "@ikyomm/database";
import {
  createDbSelectSchema,
  createListQuerySchema,
  createListResponseSchema,
  IdStringParamSchema,
} from "@ikyomm/utils";
import { z } from "@hono/zod-openapi";

const appUserOrganizationSchema = createDbSelectSchema(organization).pick({
  id: true,
  name: true,
  slug: true,
  type: true,
  isActive: true,
});

export const ommpodsAgentUserSchema = createDbSelectSchema(user).extend({
  organization: appUserOrganizationSchema.nullable().optional(),
});

const agentUserMutableFields = {
  name: z.string().min(1, "Name is required"),
  email: z.email("Invalid email address"),
  role: z.string().min(1, "Role is required"),
  image: z.url("Invalid URL").nullish(),
  phoneNumber: z.string().nullish(),
  country: z.string().nullish(),
  state: z.string().nullish(),
  city: z.string().nullish(),
  address: z.string().nullish(),
  employeeId: z.string().nullish(),
  employeeEmail: z.email("Invalid employee email address").nullish(),
  company: z.string().nullish(),
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
  address: agentUserMutableFields.address,
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
    companyAssigned: z.coerce.boolean().optional(),
    emailVerified: z.coerce.boolean().optional(),
    banned: z.coerce.boolean().optional(),
    isDeleted: z.coerce.boolean().optional(),
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
