import { session, user } from "@ikyomm/database";
import {
  createDbSelectSchema,
  createListQuerySchema,
  createListResponseSchema,
  IdStringParamSchema,
} from "@ikyomm/utils";
import { z } from "@hono/zod-openapi";

export const ommpodsUserSchema = createDbSelectSchema(user);

const ommpodsUserMutableFields = {
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
  banned: z.boolean().optional(),
  banReason: z.string().nullish(),
  banExpires: z.coerce.date().nullish(),
};

export const ommpodsUserCreateSchema = z.object(ommpodsUserMutableFields);

export const ommpodsUserUpdateSchema = z.object({
  name: ommpodsUserMutableFields.name.optional(),
  email: ommpodsUserMutableFields.email.optional(),
  role: ommpodsUserMutableFields.role.optional(),
  image: ommpodsUserMutableFields.image,
  phoneNumber: ommpodsUserMutableFields.phoneNumber,
  country: ommpodsUserMutableFields.country,
  state: ommpodsUserMutableFields.state,
  city: ommpodsUserMutableFields.city,
  employeeId: ommpodsUserMutableFields.employeeId,
  employeeEmail: ommpodsUserMutableFields.employeeEmail,
  banned: ommpodsUserMutableFields.banned,
  banReason: ommpodsUserMutableFields.banReason,
  banExpires: ommpodsUserMutableFields.banExpires,
});

export const ommpodsUserListQuerySchema = createListQuerySchema({
  sortFields: ["name", "email", "role", "phoneNumber", "createdAt", "updatedAt"],
  extraShape: {
    role: z.string().optional(),
    emailVerified: z.coerce.boolean().optional(),
    isDeleted: z.coerce.boolean().optional(),
  },
});

export type OmmpodsUserListQuery = z.infer<typeof ommpodsUserListQuerySchema>;
export type ScopedOmmpodsUserListQuery = OmmpodsUserListQuery & {
  excludeUserId?: string;
};

export const ommpodsUserListResponseSchema = createListResponseSchema(ommpodsUserSchema);

export const ommpodsUserPermanentDeleteResultSchema = z.object({
  message: z.string(),
});

export const ommpodsUserSessionSchema = createDbSelectSchema(session);
export const ommpodsUserSessionListSchema = z.array(ommpodsUserSessionSchema);
export const ommpodsUserSessionParamsSchema = IdStringParamSchema();
export const ommpodsUserSessionTokenParamsSchema = z.object({
  id: z.string().min(1),
  sessionToken: z.string().min(1),
});
export const ommpodsUserSessionRevokeResultSchema = z.object({
  message: z.string(),
});
