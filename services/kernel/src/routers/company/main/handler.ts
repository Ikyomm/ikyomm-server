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
import {
  account,
  db,
  ikyommWallet,
  member,
  organization,
  organizationWallet,
  user,
  walletTransactions,
} from "@ikyomm/database";
import { and, eq, gte, inArray, ne, sql } from "drizzle-orm";
import { emailSubject, renderAccountCredEmail, sendEmail } from "@ikyomm/notification";
import { fetchCompanyList } from "./list";
import {
  check_website_domain,
  create,
  get,
  get_settings,
  list,
  remove,
  remove_permanently,
  resendCredentials,
  restore,
  restore_only,
  update,
} from "./openapi.route";
import { COMPANY_CREATION_STEPS, type CompanyCreationStep } from "./schema";
import {
  createCompanyAuthSeed,
  ensureDefaultCompanyRoles,
  findCompanyById,
  findCompanyConflictBySlug,
  findCompanyConflictByWebsiteDomain,
  findCompanyOwnerConflicts,
  findCompanySettingsById,
  findNextCompanyId,
  getCompanyOwnerCredentialDeliveryData,
  logCredentialEmailFailure,
  restoreCompanyById,
  softDeleteCompanyById,
} from "./utils";

export const companyMainGroup = new OpenAPIHono<AppBindings>();

const createWalletLimitMessage = (available: number, requested: number) =>
  `Ikyomm wallet limit reached. Available: ${available}, requested: ${requested}.`;

registerOpenApiRoute(companyMainGroup, list, async (c) => {
  const query = c.req.valid("query");
  const response = await fetchCompanyList(query);

  return c.json(createSuccessResponse(response), 200);
});

registerOpenApiRoute(companyMainGroup, check_website_domain, async (c) => {
  const { excludeId, websiteDomain } = c.req.valid("query");
  const conflict = await findCompanyConflictByWebsiteDomain(websiteDomain, excludeId);

  return c.json(
    createSuccessResponse({
      status: !conflict,
    }),
    200
  );
});

registerOpenApiRoute(companyMainGroup, get, async (c) => {
  const { id } = c.req.valid("param");
  const company = await findCompanyById(id);

  if (!company) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: `No company found with id ${id}`,
      }),
      404
    );
  }

  return c.json(createSuccessResponse(company), 200);
});

registerOpenApiRoute(companyMainGroup, get_settings, async (c) => {
  const { id } = c.req.valid("param");
  const { user: currentAuthUser } = getBetterAuthContext(c);
  const company = await findCompanySettingsById(id, currentAuthUser?.id);

  if (!company) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: `No company found with id ${id}`,
      }),
      404
    );
  }

  return c.json(createSuccessResponse(company), 200);
});

registerOpenApiRoute(companyMainGroup, create, async (c) => {
  const body = c.req.valid("json");
  const { user: currentAuthUser } = getBetterAuthContext(c);
  const stepsCompleted: CompanyCreationStep[] = [];
  const stepsFailed: CompanyCreationStep[] = [];

  const [slugConflict, { emailExists }, authSeed, nextOrgId] = await Promise.all([
    findCompanyConflictBySlug(body.slug),
    findCompanyOwnerConflicts(body.ownerEmail),
    createCompanyAuthSeed(env.BETTER_AUTH_SECRET),
    findNextCompanyId(),
  ]);

  if (slugConflict) {
    return c.json(
      createErrorResponse({
        error: "Conflict",
        message: "Company slug already exists",
      }),
      409
    );
  }

  if (emailExists) {
    return c.json(
      createErrorResponse({
        error: "Conflict",
        message: "Company owner with this email already exists",
      }),
      409
    );
  }

  stepsCompleted.push("validate_input");

  const initialCreditMinute = body.initialCreditMinute ?? 0;

  const creationResult = await db
    .transaction(async (tx) => {
      let sourceWalletId: string | null = null;
      let sourceWalletCreditMinute = 0;

      if (initialCreditMinute > 0) {
        const [sourceWallet] = await tx
          .select()
          .from(ikyommWallet)
          .where(and(eq(ikyommWallet.singletonKey, "ikyomm"), eq(ikyommWallet.isDeleted, false)))
          .limit(1);

        if (!sourceWallet) {
          throw new Error("IKYOMM_WALLET_NOT_FOUND");
        }

        sourceWalletId = sourceWallet.id;
        sourceWalletCreditMinute = sourceWallet.creditMinute;
      }

      const [userData] = await tx
        .insert(user)
        .values({
          id: authSeed.userId,
          panel: "company",
          role: "owner",
          name: body.ownerName,
          email: body.ownerEmail,
          phoneNumber: body.ownerPhoneNumber,
        })
        .returning();
      stepsCompleted.push("insert_user");

      await tx.insert(account).values({
        id: authSeed.accountId,
        userId: authSeed.userId,
        accountId: generateRandomId(),
        providerId: "credential",
        password: authSeed.hashedPassword,
      });
      stepsCompleted.push("insert_credential_account");

      const [orgData] = await tx
        .insert(organization)
        .values({
          id: nextOrgId,
          name: body.name,
          slug: body.slug,
          logo: body.logo,
          type: body.type,
          platformMode: body.platformMode,
          metadata: body.metadata,
          country: body.country,
          state: body.state,
          city: body.city,
          address: body.address,
          email: body.email,
          phoneNumber: body.phoneNumber,
          websiteDomain: body.websiteDomain,
          isActive: body.isActive ?? true,
          createdByUser: currentAuthUser?.id ?? null,
        })
        .returning();
      await ensureDefaultCompanyRoles(tx, orgData.id);
      stepsCompleted.push("insert_organization");

      const [orgWallet] = await tx
        .insert(organizationWallet)
        .values({
          id: generateRandomId(),
          organizationId: orgData.id,
          createdByUser: currentAuthUser?.id ?? null,
        })
        .returning();
      stepsCompleted.push("insert_organization_wallet");

      if (initialCreditMinute > 0 && sourceWalletId) {
        const debitedWallets = await tx
          .update(ikyommWallet)
          .set({
            creditMinute: sql`${ikyommWallet.creditMinute} - ${initialCreditMinute}`,
            updatedByUser: currentAuthUser?.id ?? null,
          })
          .where(
            and(
              eq(ikyommWallet.id, sourceWalletId),
              gte(ikyommWallet.creditMinute, initialCreditMinute)
            )
          )
          .returning();

        if (debitedWallets.length === 0) {
          throw new Error(createWalletLimitMessage(sourceWalletCreditMinute, initialCreditMinute));
        }

        await tx
          .update(organizationWallet)
          .set({
            creditMinute: sql`${organizationWallet.creditMinute} + ${initialCreditMinute}`,
            updatedByUser: currentAuthUser?.id ?? null,
          })
          .where(eq(organizationWallet.id, orgWallet.id));

        await tx.insert(walletTransactions).values([
          {
            id: generateRandomId(),
            type: "DEBIT",
            status: "COMPLETED",
            creditMinute: initialCreditMinute,
            reference: "company_creation",
            description: "Initial company wallet credits debited from Ikyomm wallet",
            fromIkyommWalletId: sourceWalletId,
            toIkyommWalletId: sourceWalletId,
            createdByUser: currentAuthUser?.id ?? null,
          },
          {
            id: generateRandomId(),
            type: "CREDIT",
            status: "COMPLETED",
            creditMinute: initialCreditMinute,
            reference: "company_creation",
            description: "Initial company wallet credits credited from Ikyomm wallet",
            fromOrganizationWalletId: orgWallet.id,
            toOrganizationWalletId: orgWallet.id,
            createdByUser: currentAuthUser?.id ?? null,
          },
        ]);
      }
      stepsCompleted.push("transfer_initial_credits");

      await tx.insert(member).values({
        id: generateRandomId(),
        userId: authSeed.userId,
        organizationId: orgData.id,
        panel: "company",
        role: "owner",
        createdByUser: currentAuthUser?.id ?? null,
      });
      stepsCompleted.push("insert_member");

      return { userData, orgData };
    })
    .catch((error: unknown) => {
      if (error instanceof Error && error.message === "IKYOMM_WALLET_NOT_FOUND") {
        return "IKYOMM_WALLET_NOT_FOUND" as const;
      }
      if (error instanceof Error && error.message.includes("limit reached")) {
        return error.message;
      }
      throw error;
    });

  if (creationResult === "IKYOMM_WALLET_NOT_FOUND") {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "Ikyomm wallet not found",
      }),
      404
    );
  }

  if (typeof creationResult === "string" && creationResult.includes("limit reached")) {
    return c.json(
      createErrorResponse({
        error: "Bad Request",
        message: creationResult,
      }),
      400
    );
  }

  if (typeof creationResult === "string") {
    return c.json(
      createErrorResponse({
        error: "Internal Server Error",
        message: "Company creation failed unexpectedly",
      }),
      500
    );
  }

  const { userData, orgData } = creationResult;

  const company = await findCompanyById(orgData.id);
  if (!company) {
    stepsFailed.push(...COMPANY_CREATION_STEPS.filter((step) => !stepsCompleted.includes(step)));
    return c.json(
      createErrorResponse({
        error: "Internal Server Error",
        message: "Company was created but could not be reloaded",
      }),
      500
    );
  }

  void renderAccountCredEmail({
    credEmail: userData.email,
    credPassword: authSeed.password,
    organizationName: orgData.name,
    previewText: emailSubject["account-credentials"].previewText,
  })
    .then((html: string) =>
      sendEmail({
        to: userData.email,
        subject: emailSubject["account-credentials"].subject,
        html,
      })
    )
    .catch((error: unknown) => {
      logCredentialEmailFailure("[kernel.company.create] Email send failed", error);
    });

  return c.json(
    createSuccessResponse({
      company,
      owner: {
        id: userData.id,
        name: userData.name,
        email: userData.email,
        emailVerified: userData.emailVerified,
        phoneNumber: userData.phoneNumber,
      },
      completedSteps: stepsCompleted.length,
      totalSteps: COMPANY_CREATION_STEPS.length,
      stepsCompleted,
      stepsFailed,
    }),
    201
  );
});

registerOpenApiRoute(companyMainGroup, update, async (c) => {
  const { id } = c.req.valid("param");
  const body = c.req.valid("json");
  const { user: currentAuthUser } = getBetterAuthContext(c);

  const existingCompany = await findCompanyById(id);
  if (!existingCompany) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "Company not found",
      }),
      404
    );
  }

  await db
    .update(organization)
    .set({
      ...body,
      updatedByUser: currentAuthUser?.id ?? null,
    })
    .where(eq(organization.id, id));

  const updatedCompany = await findCompanyById(id);
  if (!updatedCompany) {
    return c.json(
      createErrorResponse({
        error: "Internal Server Error",
        message: "Failed to update company",
      }),
      500
    );
  }

  return c.json(createSuccessResponse(updatedCompany), 200);
});

registerOpenApiRoute(companyMainGroup, remove, async (c) => {
  const { id } = c.req.valid("param");
  const { user: currentAuthUser } = getBetterAuthContext(c);
  const existingCompany = await findCompanyById(id);

  if (!existingCompany) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "Company not found",
      }),
      404
    );
  }

  const deletedCompany = await softDeleteCompanyById(id, currentAuthUser?.id, {
    deleteRelated: true,
  });

  return c.json(createSuccessResponse(deletedCompany), 200);
});

registerOpenApiRoute(companyMainGroup, remove_permanently, async (c) => {
  const { id } = c.req.valid("param");
  const existingCompany = await findCompanyById(id, { includeDeleted: true });

  if (!existingCompany) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "Company not found",
      }),
      404
    );
  }

  await db.transaction(async (tx) => {
    const organizationMembers = await tx
      .select({
        userId: member.userId,
      })
      .from(member)
      .where(eq(member.organizationId, id));

    const memberUserIds = Array.from(
      new Set(organizationMembers.map((row) => row.userId).filter(Boolean))
    );

    await tx.delete(organization).where(eq(organization.id, id));

    if (memberUserIds.length === 0) {
      return;
    }

    const usersWithOtherOrganizations = await tx
      .select({
        userId: member.userId,
      })
      .from(member)
      .where(and(inArray(member.userId, memberUserIds), ne(member.organizationId, id)));

    const userIdsWithOtherOrganizations = new Set(
      usersWithOtherOrganizations.map((row) => row.userId)
    );
    const organizationOnlyUserIds = memberUserIds.filter(
      (userId) => !userIdsWithOtherOrganizations.has(userId)
    );

    if (organizationOnlyUserIds.length > 0) {
      await tx.delete(user).where(inArray(user.id, organizationOnlyUserIds));
    }
  });

  return c.json(
    createSuccessResponse({
      message: "Company and organization-only users permanently deleted successfully",
    }),
    200
  );
});

registerOpenApiRoute(companyMainGroup, restore, async (c) => {
  const { id } = c.req.valid("param");
  const { user: currentAuthUser } = getBetterAuthContext(c);
  const restoredCompany = await restoreCompanyById(id, currentAuthUser?.id, {
    restoreRelated: true,
  });

  if (!restoredCompany) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "Company not found",
      }),
      404
    );
  }

  return c.json(createSuccessResponse(restoredCompany), 200);
});

registerOpenApiRoute(companyMainGroup, restore_only, async (c) => {
  const { id } = c.req.valid("param");
  const { user: currentAuthUser } = getBetterAuthContext(c);
  const restoredCompany = await restoreCompanyById(id, currentAuthUser?.id, {
    restoreRelated: false,
  });

  if (!restoredCompany) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "Company not found",
      }),
      404
    );
  }

  return c.json(createSuccessResponse(restoredCompany), 200);
});

registerOpenApiRoute(companyMainGroup, resendCredentials, async (c) => {
  const { id } = c.req.valid("param");
  const deliveryData = await getCompanyOwnerCredentialDeliveryData(id, env.BETTER_AUTH_SECRET);

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
    const html = await renderAccountCredEmail({
      credEmail: deliveryData.data.email,
      credPassword: deliveryData.data.password,
      organizationName: deliveryData.data.organizationName,
      previewText: emailSubject["account-credentials"].previewText,
    });

    await sendEmail({
      to: deliveryData.data.email,
      subject: emailSubject["account-credentials"].subject,
      html,
    });
  } catch (error) {
    logger.error("[kernel.company.resend-cred] Email send failed", { error });
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
