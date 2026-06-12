import type { AppBindings } from "@/types/app";
import { env } from "@/config/env";
import { logger } from "@/lib/logger";
import { OpenAPIHono } from "@hono/zod-openapi";
import {
  createErrorResponse,
  createSuccessResponse,
  generateRandomId,
  getBetterAuthContext,
  registerOpenApiRoute,
} from "@ikyomm/utils";
import { account, db, member, user } from "@ikyomm/database";
import { eq } from "drizzle-orm";
import { emailSubject, renderMemberAccountCredEmail, sendEmail } from "@ikyomm/notification";
import { fetchMemberList } from "./list";
import {
  ban,
  create,
  get,
  list,
  remove,
  remove_with_user,
  resendCredentials,
  softDelete,
  update,
} from "./openapi.route";
import {
  createMemberAuthSeed,
  findMemberById,
  findMemberConflictByEmail,
  findMemberDetailsById,
  findOrganizationSummaryById,
  getMemberCredentialDeliveryData,
} from "./utils";
import { ensureDefaultCompanyRoles } from "../main/utils";

export const companyMembersGroup = new OpenAPIHono<AppBindings>();

registerOpenApiRoute(companyMembersGroup, list, async (c) => {
  const { companyId } = c.req.valid("param");
  const query = c.req.valid("query");
  const response = await fetchMemberList({
    ...query,
    organizationId: companyId,
  });

  return c.json(createSuccessResponse(response), 200);
});

registerOpenApiRoute(companyMembersGroup, get, async (c) => {
  const { id } = c.req.valid("param");
  const memberData = await findMemberDetailsById(id);

  if (!memberData) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "Member not found",
      }),
      404
    );
  }

  return c.json(createSuccessResponse(memberData), 200);
});

registerOpenApiRoute(companyMembersGroup, create, async (c) => {
  const body = c.req.valid("json");
  const { user: currentUser } = getBetterAuthContext(c);

  const [existingUserWithMember, orgData] = await Promise.all([
    findMemberConflictByEmail(body.email, body.organizationId),
    findOrganizationSummaryById(body.organizationId),
  ]);

  if (!orgData) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "Company not found",
      }),
      404
    );
  }

  const emailExists = Boolean(existingUserWithMember?.userId);
  const memberExists = Boolean(existingUserWithMember?.memberId);

  if (emailExists) {
    return c.json(
      createErrorResponse({
        error: "Conflict",
        message: "Member with this email already exists",
      }),
      409
    );
  }

  if (memberExists) {
    return c.json(
      createErrorResponse({
        error: "Conflict",
        message: "This user is already a member of the company",
      }),
      409
    );
  }

  const authSeed = await createMemberAuthSeed(env.BETTER_AUTH_SECRET);

  const memberData = await db.transaction(async (tx) => {
    await ensureDefaultCompanyRoles(tx, body.organizationId);

    await tx.insert(user).values({
      id: authSeed.userId,
      name: body.name,
      panel: "company",
      role: body.role,
      email: body.email,
      phoneNumber: body.phoneNumber,
    });

    await tx.insert(account).values({
      id: authSeed.accountId,
      userId: authSeed.userId,
      accountId: generateRandomId(),
      providerId: "credential",
      password: authSeed.hashedPassword,
    });

    const [memberInserted] = await tx
      .insert(member)
      .values({
        id: generateRandomId(),
        userId: authSeed.userId,
        panel: "company",
        organizationId: body.organizationId,
        role: body.role,
        createdByUser: currentUser?.id,
      })
      .returning();

    return memberInserted;
  });

  void renderMemberAccountCredEmail({
    credEmail: body.email,
    credPassword: authSeed.password,
    organizationName: orgData.name,
    role: memberData.role,
    previewText: emailSubject["member-account-cred"].previewText,
  })
    .then((html: string) =>
      sendEmail({
        to: body.email,
        subject: emailSubject["member-account-cred"].subject,
        html,
      })
    )
    .catch((error: unknown) => {
      logger.error("[kernel.company.member.create] Email send failed", { error });
    });

  return c.json(createSuccessResponse(memberData), 201);
});

registerOpenApiRoute(companyMembersGroup, update, async (c) => {
  const { id } = c.req.valid("param");
  const body = c.req.valid("json");
  const { user: currentUser } = getBetterAuthContext(c);
  const existingMember = await findMemberById(id);

  if (!existingMember) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "Member not found",
      }),
      404
    );
  }

  const [updatedMember] = await db.transaction(async (tx) => {
    await tx
      .update(user)
      .set({
        name: body.name,
        email: body.email,
        image: body.image,
        phoneNumber: body.phoneNumber,
      })
      .where(eq(user.id, existingMember.userId));

    return tx
      .update(member)
      .set({
        role: body.role,
        updatedByUser: currentUser?.id,
      })
      .where(eq(member.id, id))
      .returning();
  });

  if (!updatedMember) {
    return c.json(
      createErrorResponse({
        error: "Internal Server Error",
        message: "Failed to update member",
      }),
      500
    );
  }

  return c.json(createSuccessResponse(updatedMember), 200);
});

registerOpenApiRoute(companyMembersGroup, remove, async (c) => {
  const { id } = c.req.valid("param");
  const { user: currentUser } = getBetterAuthContext(c);
  const existingMember = await findMemberById(id);

  if (!existingMember) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "Member not found",
      }),
      404
    );
  }

  await db
    .update(member)
    .set({
      isDeleted: true,
      deletedAt: new Date(),
      deletedByUser: currentUser?.id ?? null,
      updatedByUser: currentUser?.id ?? null,
    })
    .where(eq(member.id, id));

  return c.json(
    createSuccessResponse({
      message: "Member removed successfully",
    }),
    200
  );
});

registerOpenApiRoute(companyMembersGroup, softDelete, async (c) => {
  const { id } = c.req.valid("param");
  const { user: currentUser } = getBetterAuthContext(c);
  const existingMember = await findMemberById(id);

  if (!existingMember) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "Member not found",
      }),
      404
    );
  }

  const [deletedMember] = await db
    .update(member)
    .set({
      isDeleted: true,
      deletedAt: new Date(),
      deletedByUser: currentUser?.id ?? null,
      updatedByUser: currentUser?.id ?? null,
    })
    .where(eq(member.id, id))
    .returning();

  return c.json(createSuccessResponse(deletedMember), 200);
});

registerOpenApiRoute(companyMembersGroup, remove_with_user, async (c) => {
  const { id } = c.req.valid("param");
  const { user: currentUser } = getBetterAuthContext(c);
  const existingMember = await findMemberById(id);

  if (!existingMember) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "Member not found",
      }),
      404
    );
  }

  await db.transaction(async (tx) => {
    await tx
      .update(member)
      .set({
        isDeleted: true,
        deletedAt: new Date(),
        deletedByUser: currentUser?.id ?? null,
        updatedByUser: currentUser?.id ?? null,
      })
      .where(eq(member.id, id));

    await tx
      .update(user)
      .set({
        isDeleted: true,
        deletedAt: new Date(),
        deletedByUser: currentUser?.id ?? null,
        updatedByUser: currentUser?.id ?? null,
      })
      .where(eq(user.id, existingMember.userId));
  });

  return c.json(
    createSuccessResponse({
      message: "Member with user removed successfully",
    }),
    200
  );
});

registerOpenApiRoute(companyMembersGroup, ban, async (c) => {
  const { id } = c.req.valid("param");
  const body = c.req.valid("json");
  const existingMember = await findMemberById(id);

  if (!existingMember) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "Member not found",
      }),
      404
    );
  }

  await db
    .update(user)
    .set({
      banned: body.banned,
      banReason: body.banned ? body.reason : null,
      banExpires: null,
    })
    .where(eq(user.id, existingMember.userId));

  const memberData = await findMemberDetailsById(id);

  if (!memberData) {
    return c.json(
      createErrorResponse({
        error: "Internal Server Error",
        message: "Failed to load banned member",
      }),
      500
    );
  }

  return c.json(createSuccessResponse(memberData), 200);
});

registerOpenApiRoute(companyMembersGroup, resendCredentials, async (c) => {
  const { id } = c.req.valid("param");
  const deliveryData = await getMemberCredentialDeliveryData(id, env.BETTER_AUTH_SECRET);

  if (!deliveryData.success) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: deliveryData.message,
      }),
      404
    );
  }

  try {
    const html = await renderMemberAccountCredEmail({
      credEmail: deliveryData.data.email,
      credPassword: deliveryData.data.password,
      organizationName: deliveryData.data.organizationName,
      role: deliveryData.data.role,
      previewText: emailSubject["member-account-cred"].previewText,
    });

    await sendEmail({
      to: deliveryData.data.email,
      subject: emailSubject["member-account-cred"].subject,
      html,
    });
  } catch (error) {
    logger.error("[kernel.company.member.resend-cred] Email send failed", { error });
    return c.json(
      createErrorResponse({
        error: "Internal Server Error",
        message: "Failed to resend credentials",
      }),
      500
    );
  }

  return c.json(
    createSuccessResponse({
      message: "Credentials resent successfully",
    }),
    200
  );
});
