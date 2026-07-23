import { env } from "@/config/env";
import { logger } from "@/lib/logger";
import type { AppBindings } from "@/types/app";
import { OpenAPIHono } from "@hono/zod-openapi";
import { account, db, session, user } from "@ikyomm/database";
import { emailSubject, renderIkyommAccountCredEmail, sendEmail } from "@ikyomm/notification";
import {
  createErrorResponse,
  createSuccessResponse,
  generateRandomId,
  getBetterAuthContext,
  registerOpenApiRoute,
} from "@ikyomm/utils";
import { and, eq } from "drizzle-orm";
import { ikyommAppUsersGroup } from "./agent/handler";
import { fetchOmmpodsUserList } from "./list";
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
  createOmmpodsUserAuthSeed,
  findOmmpodsUserById,
  findOmmpodsUserConflictByEmail,
  findOmmpodsUserConflictByPhoneNumber,
  getOmmpodsUserCredentialDeliveryData,
  listOmmpodsUserSessions,
} from "./utils";

export const ikyommUsersGroup = new OpenAPIHono<AppBindings>();

ikyommUsersGroup.route("/agent", ikyommAppUsersGroup);

registerOpenApiRoute(ikyommUsersGroup, list, async (c) => {
  const query = c.req.valid("query");
  const { user: currentUser } = getBetterAuthContext(c);
  const response = await fetchOmmpodsUserList({
    ...query,
    excludeUserId: currentUser?.id,
  });

  return c.json(createSuccessResponse(response), 200);
});

registerOpenApiRoute(ikyommUsersGroup, get, async (c) => {
  const { id } = c.req.valid("param");
  const userData = await findOmmpodsUserById(id, { includeDeleted: true });

  if (!userData) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "Ommpods user not found",
      }),
      404
    );
  }

  return c.json(createSuccessResponse(userData), 200);
});

registerOpenApiRoute(ikyommUsersGroup, listSessions, async (c) => {
  const { id } = c.req.valid("param");
  const userData = await findOmmpodsUserById(id, { includeDeleted: true });

  if (!userData) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "Ommpods user not found",
      }),
      404
    );
  }

  const sessions = await listOmmpodsUserSessions(id);
  return c.json(createSuccessResponse(sessions), 200);
});

registerOpenApiRoute(ikyommUsersGroup, create, async (c) => {
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

  const authSeed = await createOmmpodsUserAuthSeed(env.BETTER_AUTH_SECRET, body.password);

  const userData = await db.transaction(async (tx) => {
    const [insertedUser] = await tx
      .insert(user)
      .values({
        id: authSeed.userId,
        name: body.name,
        email: body.email,
        image: body.image,
        role: body.role,
        panel: "ikyomm",
        phoneNumber: body.phoneNumber,
        country: body.country,
        state: body.state,
        city: body.city,
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

  void renderIkyommAccountCredEmail({
    credEmail: userData.email,
    credPassword: authSeed.password,
    role: userData.role ?? body.role,
    previewText: emailSubject["ikyomm-account-cred"].previewText,
  })
    .then((html) =>
      sendEmail({
        to: userData.email,
        subject: emailSubject["ikyomm-account-cred"].subject,
        html,
      })
    )
    .catch((error: unknown) => {
      logger.error("[kernel.ommpods.users.create] Email send failed", { error });
    });

  return c.json(createSuccessResponse(userData), 201);
});

registerOpenApiRoute(ikyommUsersGroup, update, async (c) => {
  const { id } = c.req.valid("param");
  const body = c.req.valid("json");
  const { user: currentUser } = getBetterAuthContext(c);

  const existingUser = await findOmmpodsUserById(id);

  if (!existingUser) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "Ommpods user not found",
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

  const [updatedUser] = await db
    .update(user)
    .set({
      ...body,
      panel: "ikyomm",
      updatedByUser: currentUser?.id,
    })
    .where(eq(user.id, id))
    .returning();

  if (!updatedUser) {
    return c.json(
      createErrorResponse({
        error: "Internal Server Error",
        message: "Failed to update Ommpods user",
      }),
      500
    );
  }

  return c.json(createSuccessResponse(updatedUser), 200);
});

registerOpenApiRoute(ikyommUsersGroup, remove, async (c) => {
  const { id } = c.req.valid("param");
  const { user: currentUser } = getBetterAuthContext(c);
  const existingUser = await findOmmpodsUserById(id);

  if (!existingUser) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "Ommpods user not found",
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
        message: "Failed to delete Ommpods user",
      }),
      500
    );
  }

  return c.json(createSuccessResponse(deletedUser), 200);
});

registerOpenApiRoute(ikyommUsersGroup, removePermanently, async (c) => {
  const { id } = c.req.valid("param");
  const existingUser = await findOmmpodsUserById(id, { includeDeleted: true });

  if (!existingUser) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "Ommpods user not found",
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
        message: "Failed to permanently delete Ommpods user",
      }),
      500
    );
  }

  return c.json(
    createSuccessResponse({
      message: "User permanently deleted successfully",
    }),
    200
  );
});

registerOpenApiRoute(ikyommUsersGroup, restore, async (c) => {
  const { id } = c.req.valid("param");
  const { user: currentUser } = getBetterAuthContext(c);
  const existingUser = await findOmmpodsUserById(id, { includeDeleted: true });

  if (!existingUser) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "Ommpods user not found",
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

registerOpenApiRoute(ikyommUsersGroup, resendCredentials, async (c) => {
  const { id } = c.req.valid("param");
  const credentialData = await getOmmpodsUserCredentialDeliveryData(id, env.BETTER_AUTH_SECRET);

  if (!credentialData.success) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: credentialData.message,
      }),
      404
    );
  }

  void renderIkyommAccountCredEmail({
    credEmail: credentialData.data.email,
    credPassword: credentialData.data.password,
    role: credentialData.data.role,
    previewText: emailSubject["ikyomm-account-cred"].previewText,
  })
    .then((html) =>
      sendEmail({
        to: credentialData.data.email,
        subject: emailSubject["ikyomm-account-cred"].subject,
        html,
      })
    )
    .catch((error: unknown) => {
      logger.error("[kernel.ommpods.users.resend-cred] Email send failed", { error });
    });

  return c.json(
    createSuccessResponse({
      message: "Credentials resent successfully",
    }),
    200
  );
});

registerOpenApiRoute(ikyommUsersGroup, revokeSession, async (c) => {
  const { id, sessionToken } = c.req.valid("param");
  const userData = await findOmmpodsUserById(id, { includeDeleted: true });

  if (!userData) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "Ommpods user not found",
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
        message: "User session not found",
      }),
      404
    );
  }

  return c.json(createSuccessResponse({ message: "Session terminated successfully" }), 200);
});

registerOpenApiRoute(ikyommUsersGroup, revokeAllSessions, async (c) => {
  const { id } = c.req.valid("param");
  const userData = await findOmmpodsUserById(id, { includeDeleted: true });

  if (!userData) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "Ommpods user not found",
      }),
      404
    );
  }

  await db.delete(session).where(eq(session.userId, id));

  return c.json(createSuccessResponse({ message: "All sessions terminated successfully" }), 200);
});
