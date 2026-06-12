import { env } from "@/config/env";
import { logger } from "@/lib/logger";
import type { AppBindings } from "@/types/app";
import { OpenAPIHono } from "@hono/zod-openapi";
import { account, db, session, user } from "@ikyomm/database";
import { emailSubject, renderIkyommAppAccountCredEmail, sendEmail } from "@ikyomm/notification";
import {
  createErrorResponse,
  createSuccessResponse,
  generateRandomId,
  getBetterAuthContext,
  registerOpenApiRoute,
} from "@ikyomm/utils";
import { and, eq } from "drizzle-orm";
import { fetchOmmpodsAgentUserList } from "./list";
import {
  create,
  get,
  list,
  listSessions,
  remove,
  removePermanently,
  resendCredentials,
  restore,
  revokeAllSessions,
  revokeSession,
  update,
} from "./openapi.route";
import {
  createOmmpodsAgentAuthSeed,
  findActiveAppRoleBySlug,
  findActiveOrganizationById,
  findOmmpodsAgentUserById,
  findOmmpodsUserConflictByEmail,
  findOmmpodsUserConflictByPhoneNumber,
  getOmmpodsAgentUserCredentialDeliveryData,
  listOmmpodsAgentUserSessions,
} from "./utils";

export const ikyommAppUsersGroup = new OpenAPIHono<AppBindings>();

registerOpenApiRoute(ikyommAppUsersGroup, list, async (c) => {
  const query = c.req.valid("query");
  const { user: currentUser } = getBetterAuthContext(c);
  const response = await fetchOmmpodsAgentUserList({
    ...query,
    excludeUserId: currentUser?.id,
  });

  return c.json(createSuccessResponse(response), 200);
});

registerOpenApiRoute(ikyommAppUsersGroup, get, async (c) => {
  const { id } = c.req.valid("param");
  const userData = await findOmmpodsAgentUserById(id, { includeDeleted: true });

  if (!userData) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "App user not found",
      }),
      404
    );
  }

  return c.json(createSuccessResponse(userData), 200);
});

registerOpenApiRoute(ikyommAppUsersGroup, listSessions, async (c) => {
  const { id } = c.req.valid("param");
  const userData = await findOmmpodsAgentUserById(id);

  if (!userData) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "App user not found",
      }),
      404
    );
  }

  const sessions = await listOmmpodsAgentUserSessions(id);
  return c.json(createSuccessResponse(sessions), 200);
});

registerOpenApiRoute(ikyommAppUsersGroup, create, async (c) => {
  const body = c.req.valid("json");
  const { user: currentUser } = getBetterAuthContext(c);

  const existingUser = await findOmmpodsUserConflictByEmail(body.email);
  if (existingUser) {
    return c.json(
      createErrorResponse({
        error: "Conflict",
        message: "User with this email already exists",
      }),
      409
    );
  }

  if (body.phoneNumber) {
    const phoneConflict = await findOmmpodsUserConflictByPhoneNumber(body.phoneNumber);

    if (phoneConflict) {
      return c.json(
        createErrorResponse({
          error: "Conflict",
          message: "User with this phone number already exists",
        }),
        409
      );
    }
  }

  const companyId = body.company?.trim() || null;
  const companyData = companyId ? await findActiveOrganizationById(companyId) : null;

  if (companyId && !companyData) {
    return c.json(
      createErrorResponse({
        error: "Bad Request",
        message: "Select a valid active company",
      }),
      400
    );
  }

  const roleSlug = body.role ?? "owner";
  const appRole = await findActiveAppRoleBySlug(roleSlug, companyId);

  if (!appRole) {
    return c.json(
      createErrorResponse({
        error: "Bad Request",
        message: companyId
          ? `Create and activate the "${roleSlug}" company role before assigning it to this company app user`
          : `Create and activate the "${roleSlug}" app role before assigning it to app users`,
      }),
      400
    );
  }

  const authSeed = await createOmmpodsAgentAuthSeed(env.BETTER_AUTH_SECRET);

  const userData = await db.transaction(async (tx) => {
    const [insertedUser] = await tx
      .insert(user)
      .values({
        id: authSeed.userId,
        name: body.name,
        email: body.email,
        image: body.image,
        role: appRole.slug,
        panel: "app",
        company: companyId,
        phoneNumber: body.phoneNumber,
        country: body.country,
        state: body.state,
        city: body.city,
        address: body.address,
        employeeId: body.employeeId,
        employeeEmail: body.employeeEmail,
        createdByUser: currentUser?.id,
      })
      .returning();

    await tx.insert(account).values({
      id: authSeed.accountId,
      userId: authSeed.userId,
      accountId: generateRandomId(),
      providerId: "credential",
      password: authSeed.hashedPassword,
    });

    return insertedUser;
  });

  const userWithCompany = await findOmmpodsAgentUserById(userData.id, { includeDeleted: true });

  void renderIkyommAppAccountCredEmail({
    credEmail: userData.email,
    credPassword: authSeed.password,
    appUserName: userData.name,
    role: userData.role,
    previewText: emailSubject["ikyomm-app-account-cred"].previewText,
  })
    .then((html) =>
      sendEmail({
        to: userData.email,
        subject: emailSubject["ikyomm-app-account-cred"].subject,
        html,
      })
    )
    .catch((error: unknown) => {
      logger.error("[kernel.ommpods.users.agent.create] Email send failed", { error });
    });

  return c.json(createSuccessResponse(userWithCompany ?? userData), 201);
});

registerOpenApiRoute(ikyommAppUsersGroup, update, async (c) => {
  const { id } = c.req.valid("param");
  const body = c.req.valid("json");
  const { user: currentUser } = getBetterAuthContext(c);
  const existingUser = await findOmmpodsAgentUserById(id);

  if (!existingUser) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "App user not found",
      }),
      404
    );
  }

  if (body.email && body.email !== existingUser.email) {
    const emailConflict = await findOmmpodsUserConflictByEmail(body.email, id);

    if (emailConflict) {
      return c.json(
        createErrorResponse({
          error: "Conflict",
          message: "User with this email already exists",
        }),
        409
      );
    }
  }

  if (body.phoneNumber && body.phoneNumber !== existingUser.phoneNumber) {
    const phoneConflict = await findOmmpodsUserConflictByPhoneNumber(body.phoneNumber, id);

    if (phoneConflict) {
      return c.json(
        createErrorResponse({
          error: "Conflict",
          message: "User with this phone number already exists",
        }),
        409
      );
    }
  }

  const nextCompanyId =
    body.company === undefined ? existingUser.company : body.company?.trim() || null;
  const companyData = nextCompanyId ? await findActiveOrganizationById(nextCompanyId) : null;

  if (nextCompanyId && !companyData) {
    return c.json(
      createErrorResponse({
        error: "Bad Request",
        message: "Select a valid active company",
      }),
      400
    );
  }

  if (body.role || body.company !== undefined) {
    const roleSlug = body.role ?? existingUser.role;
    const appRole = await findActiveAppRoleBySlug(roleSlug, nextCompanyId);

    if (!appRole) {
      return c.json(
        createErrorResponse({
          error: "Bad Request",
          message: nextCompanyId
            ? "Select a valid active company role"
            : "Select a valid active app role",
        }),
        400
      );
    }
  }

  const [updatedUser] = await db
    .update(user)
    .set({
      ...body,
      panel: "app",
      company: nextCompanyId,
      updatedByUser: currentUser?.id,
    })
    .where(eq(user.id, id))
    .returning();

  if (!updatedUser) {
    return c.json(
      createErrorResponse({
        error: "Internal Server Error",
        message: "Failed to update app user",
      }),
      500
    );
  }

  const userWithCompany = await findOmmpodsAgentUserById(updatedUser.id, {
    includeDeleted: true,
  });

  return c.json(createSuccessResponse(userWithCompany ?? updatedUser), 200);
});

registerOpenApiRoute(ikyommAppUsersGroup, remove, async (c) => {
  const { id } = c.req.valid("param");
  const { user: currentUser } = getBetterAuthContext(c);
  const existingUser = await findOmmpodsAgentUserById(id);

  if (!existingUser) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "App user not found",
      }),
      404
    );
  }

  const [deletedUser] = await db
    .update(user)
    .set({
      isDeleted: true,
      deletedAt: new Date(),
      deletedByUser: currentUser?.id,
    })
    .where(eq(user.id, id))
    .returning();

  if (!deletedUser) {
    return c.json(
      createErrorResponse({
        error: "Internal Server Error",
        message: "Failed to delete app user",
      }),
      500
    );
  }

  return c.json(createSuccessResponse(deletedUser), 200);
});

registerOpenApiRoute(ikyommAppUsersGroup, removePermanently, async (c) => {
  const { id } = c.req.valid("param");
  const existingUser = await findOmmpodsAgentUserById(id, { includeDeleted: true });

  if (!existingUser) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "App user not found",
      }),
      404
    );
  }

  const [deletedUser] = await db.delete(user).where(eq(user.id, id)).returning({
    id: user.id,
  });

  if (!deletedUser) {
    return c.json(
      createErrorResponse({
        error: "Internal Server Error",
        message: "Failed to permanently delete app user",
      }),
      500
    );
  }

  return c.json(
    createSuccessResponse({
      message: "App user permanently deleted successfully",
    }),
    200
  );
});

registerOpenApiRoute(ikyommAppUsersGroup, restore, async (c) => {
  const { id } = c.req.valid("param");
  const { user: currentUser } = getBetterAuthContext(c);
  const existingUser = await findOmmpodsAgentUserById(id, { includeDeleted: true });

  if (!existingUser) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "App user not found",
      }),
      404
    );
  }

  const [restoredUser] = await db
    .update(user)
    .set({
      isDeleted: false,
      deletedAt: null,
      deletedByUser: null,
      updatedByUser: currentUser?.id,
    })
    .where(eq(user.id, id))
    .returning();

  return c.json(createSuccessResponse(restoredUser), 200);
});

registerOpenApiRoute(ikyommAppUsersGroup, resendCredentials, async (c) => {
  const { id } = c.req.valid("param");
  const credentialData = await getOmmpodsAgentUserCredentialDeliveryData(
    id,
    env.BETTER_AUTH_SECRET
  );

  if (!credentialData.success) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: credentialData.message,
      }),
      404
    );
  }

  try {
    const html = await renderIkyommAppAccountCredEmail({
      credEmail: credentialData.data.email,
      credPassword: credentialData.data.password,
      appUserName: credentialData.data.agentName,
      role: credentialData.data.role,
      previewText: emailSubject["ikyomm-app-account-cred"].previewText,
    });

    await sendEmail({
      to: credentialData.data.email,
      subject: emailSubject["ikyomm-app-account-cred"].subject,
      html,
    });
  } catch (error) {
    logger.error("[kernel.ommpods.users.agent.resend-cred] Email send failed", { error });
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

registerOpenApiRoute(ikyommAppUsersGroup, revokeSession, async (c) => {
  const { id, sessionToken } = c.req.valid("param");
  const userData = await findOmmpodsAgentUserById(id);

  if (!userData) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "App user not found",
      }),
      404
    );
  }

  const [deletedSession] = await db
    .delete(session)
    .where(and(eq(session.userId, id), eq(session.token, sessionToken)))
    .returning({ token: session.token });

  if (!deletedSession) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "App user session not found",
      }),
      404
    );
  }

  return c.json(
    createSuccessResponse({
      message: "Session terminated successfully",
    }),
    200
  );
});

registerOpenApiRoute(ikyommAppUsersGroup, revokeAllSessions, async (c) => {
  const { id } = c.req.valid("param");
  const userData = await findOmmpodsAgentUserById(id);

  if (!userData) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "App user not found",
      }),
      404
    );
  }

  await db.delete(session).where(eq(session.userId, id));

  return c.json(
    createSuccessResponse({
      message: "All sessions terminated successfully",
    }),
    200
  );
});
