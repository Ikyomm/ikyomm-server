import { member, user } from "@ikyomm/database";
import {
  createDbInsertSchema,
  createDbSelectSchema,
  createDbUpdateSchema,
  IdStringParamSchema,
  createListQuerySchema,
  createListResponseSchema,
} from "@ikyomm/utils";
import z from "zod";

export const memberSchema = createDbSelectSchema(member);

export const memberListUserSchema = createDbSelectSchema(user);

export const memberListItemSchema = memberSchema.extend({
  user: memberListUserSchema,
});

export const memberCreateSchema = createDbInsertSchema(member, {
  omit: [
    "id",
    "userId",
    "panel",
    "isDeleted",
    "createdAt",
    "updatedAt",
    "deletedAt",
    "createdByUser",
    "updatedByUser",
    "deletedByUser",
  ],
  customizeSchema(schema) {
    return schema.extend({
      email: z.email("Invalid email address"),
      name: z.string().min(1, "Name is required"),
      phoneNumber: z.string().optional(),
    });
  },
});

export const memberUpdateSchema = createDbUpdateSchema(member, {
  customizeSchema(schema) {
    return schema
      .pick({
        role: true,
        regionId: true,
        zoneId: true,
        locationId: true,
      })
      .extend({
        name: z.string().min(1, "Name is required").optional(),
        image: z.url("Invalid URL").optional(),
        email: z.email("Invalid email address").optional(),
        phoneNumber: z.string().optional(),
      });
  },
});

export const memberBanSchema = z
  .object({
    banned: z.boolean().default(true),
    reason: z.string().trim().min(1, "Ban reason is required").nullable().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.banned && !value.reason?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["reason"],
        message: "Ban reason is required",
      });
    }
  });

export const memberListParamsSchema = IdStringParamSchema("companyId");

export const memberListQuerySchema = createListQuerySchema({
  sortFields: ["name", "email", "role", "createdAt", "updatedAt"],
  extraShape: {
    role: z.string().optional(),
    panel: z.string().optional(),
    regionId: z.string().optional(),
    zoneId: z.string().optional(),
    locationId: z.string().optional(),
    emailVerified: z.coerce.boolean().optional(),
  },
});

export const memberDeleteWithUserResultSchema = z.object({
  message: z.string(),
});

export const memberRemoveResultSchema = z.object({
  message: z.string(),
});

export type MemberListQuery = z.infer<typeof memberListQuerySchema>;
export type ScopedMemberListQuery = MemberListQuery & {
  organizationId?: string;
};

export const memberListResponseSchema = createListResponseSchema(memberListItemSchema);
