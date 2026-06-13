import { env } from "@/config/env";
import { logger } from "@/lib/logger";
import type { AppBindings } from "@/types/app";
import { OpenAPIHono } from "@hono/zod-openapi";
import {
  account,
  db,
  ikyommWallet,
  organizationWallet,
  podSessions,
  session,
  user,
  userWallet,
  walletTransactions,
} from "@ikyomm/database";
import { emailSubject, renderIkyommAppAccountCredEmail, sendEmail } from "@ikyomm/notification";
import {
  createErrorResponse,
  createSuccessResponse,
  generateRandomId,
  getBetterAuthContext,
  registerOpenApiRoute,
} from "@ikyomm/utils";
import { and, eq, gte, inArray, or, sql } from "drizzle-orm";
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

const createWalletLimitMessage = (walletLabel: string, available: number, requested: number) =>
  `${walletLabel} limit reached. Available: ${available}, requested: ${requested}.`;

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
  const appRole = await findActiveAppRoleBySlug(roleSlug);

  if (!appRole) {
    return c.json(
      createErrorResponse({
        error: "Bad Request",
        message: `Create and activate the "${roleSlug}" app role before assigning it to app users`,
      }),
      400
    );
  }

  const authSeed = await createOmmpodsAgentAuthSeed(env.BETTER_AUTH_SECRET);
  const initialCreditMinute = body.creditMinute ?? 0;

  const userData = await db
    .transaction(async (tx) => {
      let sourceIkyommWalletId: string | null = null;
      let sourceCompanyWalletId: string | null = null;

      if (initialCreditMinute > 0 && companyId) {
        const [sourceWallet] = await tx
          .select()
          .from(organizationWallet)
          .where(
            and(
              eq(organizationWallet.organizationId, companyId),
              eq(organizationWallet.isDeleted, false)
            )
          )
          .limit(1);

        if (!sourceWallet) {
          throw new Error("COMPANY_WALLET_NOT_FOUND");
        }

        sourceCompanyWalletId = sourceWallet.id;

        const debitedWallets = await tx
          .update(organizationWallet)
          .set({
            creditMinute: sql`${organizationWallet.creditMinute} - ${initialCreditMinute}`,
            updatedByUser: currentUser?.id ?? null,
          })
          .where(
            and(
              eq(organizationWallet.id, sourceWallet.id),
              gte(organizationWallet.creditMinute, initialCreditMinute)
            )
          )
          .returning({ id: organizationWallet.id });

        if (debitedWallets.length === 0) {
          throw new Error(
            createWalletLimitMessage(
              "Company wallet",
              sourceWallet.creditMinute,
              initialCreditMinute
            )
          );
        }
      }

      if (initialCreditMinute > 0 && !companyId) {
        const [sourceWallet] = await tx
          .select()
          .from(ikyommWallet)
          .where(and(eq(ikyommWallet.singletonKey, "ikyomm"), eq(ikyommWallet.isDeleted, false)))
          .limit(1);

        if (!sourceWallet) {
          throw new Error("IKYOMM_WALLET_NOT_FOUND");
        }

        sourceIkyommWalletId = sourceWallet.id;

        const debitedWallets = await tx
          .update(ikyommWallet)
          .set({
            creditMinute: sql`${ikyommWallet.creditMinute} - ${initialCreditMinute}`,
            updatedByUser: currentUser?.id ?? null,
          })
          .where(
            and(
              eq(ikyommWallet.id, sourceWallet.id),
              gte(ikyommWallet.creditMinute, initialCreditMinute)
            )
          )
          .returning({ id: ikyommWallet.id });

        if (debitedWallets.length === 0) {
          throw new Error(
            createWalletLimitMessage(
              "Ikyomm wallet",
              sourceWallet.creditMinute,
              initialCreditMinute
            )
          );
        }
      }

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

      if (initialCreditMinute > 0) {
        const [destinationWallet] = await tx
          .insert(userWallet)
          .values({
            id: generateRandomId(),
            userId: insertedUser.id,
            creditMinute: initialCreditMinute,
            createdByUser: currentUser?.id ?? null,
          })
          .returning();

        await tx.insert(walletTransactions).values([
          {
            id: generateRandomId(),
            type: "DEBIT",
            status: "COMPLETED",
            creditMinute: initialCreditMinute,
            description: companyId
              ? "Initial app user credits debited from company wallet"
              : "Initial app user credits debited from Ikyomm wallet",
            fromIkyommWalletId: sourceIkyommWalletId,
            toIkyommWalletId: sourceIkyommWalletId,
            fromOrganizationWalletId: sourceCompanyWalletId,
            toOrganizationWalletId: sourceCompanyWalletId,
            createdByUser: currentUser?.id ?? null,
          },
          {
            id: generateRandomId(),
            type: "CREDIT",
            status: "COMPLETED",
            creditMinute: initialCreditMinute,
            description: companyId
              ? "Initial app user credits credited from company wallet"
              : "Initial app user credits credited from Ikyomm wallet",
            fromUserWalletId: destinationWallet.id,
            toUserWalletId: destinationWallet.id,
            createdByUser: currentUser?.id ?? null,
          },
        ]);
      }

      return insertedUser;
    })
    .catch((error: unknown) => {
      if (error instanceof Error) {
        if (error.message === "IKYOMM_WALLET_NOT_FOUND") {
          return "IKYOMM_WALLET_NOT_FOUND" as const;
        }
        if (error.message === "COMPANY_WALLET_NOT_FOUND") {
          return "COMPANY_WALLET_NOT_FOUND" as const;
        }
        if (error.message.includes("limit reached")) {
          return error.message;
        }
      }

      throw error;
    });

  if (userData === "IKYOMM_WALLET_NOT_FOUND") {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "Ikyomm wallet not found",
      }),
      404
    );
  }

  if (userData === "COMPANY_WALLET_NOT_FOUND") {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "Company wallet not found",
      }),
      404
    );
  }

  if (typeof userData === "string" && userData.includes("limit reached")) {
    return c.json(
      createErrorResponse({
        error: "Bad Request",
        message: userData,
      }),
      400
    );
  }

  if (typeof userData === "string") {
    return c.json(
      createErrorResponse({
        error: "Internal Server Error",
        message: "App user creation failed unexpectedly",
      }),
      500
    );
  }

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
    const appRole = await findActiveAppRoleBySlug(roleSlug);

    if (!appRole) {
      return c.json(
        createErrorResponse({
          error: "Bad Request",
          message: "Select a valid active app role",
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

  const deletedUser = await db.transaction(async (tx) => {
    const appUserWallets = await tx
      .select({ id: userWallet.id })
      .from(userWallet)
      .where(eq(userWallet.userId, id));
    const appUserWalletIds = appUserWallets.map((wallet) => wallet.id);

    if (appUserWalletIds.length > 0) {
      await tx
        .delete(walletTransactions)
        .where(
          or(
            inArray(walletTransactions.fromUserWalletId, appUserWalletIds),
            inArray(walletTransactions.toUserWalletId, appUserWalletIds)
          )
        );
    }

    await tx.delete(podSessions).where(eq(podSessions.userId, id));
    await tx.delete(session).where(eq(session.userId, id));
    await tx.delete(account).where(eq(account.userId, id));
    await tx.delete(userWallet).where(eq(userWallet.userId, id));

    const [removedUser] = await tx.delete(user).where(eq(user.id, id)).returning({
      id: user.id,
    });

    return removedUser;
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
