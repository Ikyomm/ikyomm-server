import type { AppBindings } from "@/types/app";
import { OpenAPIHono } from "@hono/zod-openapi";
import {
  db,
  ikyommWallet,
  member,
  organization,
  organizationWallet,
  user,
  userWallet,
  walletTransactions,
} from "@ikyomm/database";
import {
  createErrorResponse,
  createSuccessResponse,
  generateRandomId,
  getBetterAuthContext,
  registerOpenApiRoute,
} from "@ikyomm/utils";
import { and, eq, gte, sql } from "drizzle-orm";
import { addCredits, create, get, listTransactions, transferUserCredits } from "./openapi.route";
import { fetchCompanyWalletTransactionList } from "./list";
import { findCompanyWallet } from "./utils";

export const companyWalletGroup = new OpenAPIHono<AppBindings>();

const createWalletLimitMessage = (walletLabel: string, available: number, requested: number) =>
  `${walletLabel} limit reached. Available: ${available}, requested: ${requested}.`;

registerOpenApiRoute(companyWalletGroup, get, async (c) => {
  const { id } = c.req.valid("param");
  const wallet = await findCompanyWallet(id);

  return c.json(createSuccessResponse(wallet ?? null), 200);
});

registerOpenApiRoute(companyWalletGroup, create, async (c) => {
  const { id } = c.req.valid("param");
  const body = c.req.valid("json");
  const { user: currentUser } = getBetterAuthContext(c);

  const company = await db.query.organization.findFirst({
    where: and(eq(organization.id, id), eq(organization.isDeleted, false)),
  });

  if (!company) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "Company not found",
      }),
      404
    );
  }

  const existingWallet = await findCompanyWallet(id);
  if (existingWallet) {
    return c.json(createSuccessResponse(existingWallet), 200);
  }

  const [wallet] = await db
    .insert(organizationWallet)
    .values({
      id: generateRandomId(),
      organizationId: id,
      reference: body.reference ?? null,
      createdByUser: currentUser?.id ?? null,
    })
    .returning();

  return c.json(createSuccessResponse(wallet), 201);
});

registerOpenApiRoute(companyWalletGroup, addCredits, async (c) => {
  const { id } = c.req.valid("param");
  const body = c.req.valid("json");
  const { user: currentUser } = getBetterAuthContext(c);

  const company = await db.query.organization.findFirst({
    where: and(eq(organization.id, id), eq(organization.isDeleted, false)),
  });

  if (!company) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "Company not found",
      }),
      404
    );
  }

  const walletResult = await db
    .transaction(async (tx) => {
      const [sourceWallet] = await tx
        .select()
        .from(ikyommWallet)
        .where(and(eq(ikyommWallet.singletonKey, "ikyomm"), eq(ikyommWallet.isDeleted, false)))
        .limit(1);

      if (!sourceWallet) {
        throw new Error("IKYOMM_WALLET_NOT_FOUND");
      }

      const [destinationWallet] = await tx
        .insert(organizationWallet)
        .values({
          id: generateRandomId(),
          organizationId: id,
          createdByUser: currentUser?.id ?? null,
        })
        .onConflictDoUpdate({
          target: organizationWallet.organizationId,
          set: {
            isDeleted: false,
            deletedAt: null,
            deletedByUser: null,
            updatedByUser: currentUser?.id ?? null,
          },
        })
        .returning();

      const debitedWallets = await tx
        .update(ikyommWallet)
        .set({
          creditMinute: sql`${ikyommWallet.creditMinute} - ${body.creditMinute}`,
          updatedByUser: currentUser?.id ?? null,
        })
        .where(
          and(
            eq(ikyommWallet.id, sourceWallet.id),
            gte(ikyommWallet.creditMinute, body.creditMinute)
          )
        )
        .returning();

      if (debitedWallets.length === 0) {
        throw new Error(
          createWalletLimitMessage("Ikyomm wallet", sourceWallet.creditMinute, body.creditMinute)
        );
      }

      const creditedWallets = await tx
        .update(organizationWallet)
        .set({
          creditMinute: sql`${organizationWallet.creditMinute} + ${body.creditMinute}`,
          updatedByUser: currentUser?.id ?? null,
        })
        .where(eq(organizationWallet.id, destinationWallet.id))
        .returning();

      await tx.insert(walletTransactions).values([
        {
          id: generateRandomId(),
          type: "DEBIT",
          status: "COMPLETED",
          creditMinute: body.creditMinute,
          reference: body.reference ?? null,
          description:
            body.description ?? "Credit minutes debited from Ikyomm wallet to company wallet",
          fromIkyommWalletId: sourceWallet.id,
          toIkyommWalletId: sourceWallet.id,
          createdByUser: currentUser?.id ?? null,
        },
        {
          id: generateRandomId(),
          type: "CREDIT",
          status: "COMPLETED",
          creditMinute: body.creditMinute,
          reference: body.reference ?? null,
          description:
            body.description ?? "Credit minutes credited to company wallet from Ikyomm wallet",
          fromOrganizationWalletId: destinationWallet.id,
          toOrganizationWalletId: destinationWallet.id,
          createdByUser: currentUser?.id ?? null,
        },
      ]);

      return creditedWallets;
    })
    .catch((error: unknown) => {
      if (error instanceof Error && error.message === "IKYOMM_WALLET_NOT_FOUND") {
        return null;
      }
      if (error instanceof Error && error.message.includes("limit reached")) {
        return error.message;
      }
      throw error;
    });

  if (walletResult === null) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "Ikyomm wallet not found",
      }),
      404
    );
  }

  if (typeof walletResult === "string") {
    return c.json(
      createErrorResponse({
        error: "Bad Request",
        message: walletResult,
      }),
      400
    );
  }

  return c.json(createSuccessResponse(walletResult[0]), 200);
});

registerOpenApiRoute(companyWalletGroup, listTransactions, async (c) => {
  const { id } = c.req.valid("param");
  const query = c.req.valid("query");
  const response = await fetchCompanyWalletTransactionList(id, query);

  return c.json(createSuccessResponse(response), 200);
});

registerOpenApiRoute(companyWalletGroup, transferUserCredits, async (c) => {
  const { id, userId } = c.req.valid("param");
  const body = c.req.valid("json");
  const { user: currentUser } = getBetterAuthContext(c);

  const companyUser = await db
    .select({ id: user.id })
    .from(user)
    .leftJoin(member, and(eq(member.userId, user.id), eq(member.organizationId, id)))
    .where(
      and(
        eq(user.id, userId),
        eq(user.isDeleted, false),
        sql`(${user.company} = ${id} OR ${member.id} IS NOT NULL)`
      )
    )
    .limit(1);

  if (companyUser.length === 0) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "User not found in this company",
      }),
      404
    );
  }

  const walletResult = await db
    .transaction(async (tx) => {
      const [sourceWallet] = await tx
        .select()
        .from(organizationWallet)
        .where(
          and(eq(organizationWallet.organizationId, id), eq(organizationWallet.isDeleted, false))
        )
        .limit(1);

      if (!sourceWallet) {
        throw new Error("COMPANY_WALLET_NOT_FOUND");
      }

      const [destinationWallet] = await tx
        .insert(userWallet)
        .values({
          id: generateRandomId(),
          userId,
          createdByUser: currentUser?.id ?? null,
        })
        .onConflictDoUpdate({
          target: userWallet.userId,
          set: {
            isDeleted: false,
            deletedAt: null,
            deletedByUser: null,
            updatedByUser: currentUser?.id ?? null,
          },
        })
        .returning();

      const debitedWallets = await tx
        .update(organizationWallet)
        .set({
          creditMinute: sql`${organizationWallet.creditMinute} - ${body.creditMinute}`,
          updatedByUser: currentUser?.id ?? null,
        })
        .where(
          and(
            eq(organizationWallet.id, sourceWallet.id),
            gte(organizationWallet.creditMinute, body.creditMinute)
          )
        )
        .returning();

      if (debitedWallets.length === 0) {
        throw new Error(
          createWalletLimitMessage("Company wallet", sourceWallet.creditMinute, body.creditMinute)
        );
      }

      await tx
        .update(userWallet)
        .set({
          creditMinute: sql`${userWallet.creditMinute} + ${body.creditMinute}`,
          updatedByUser: currentUser?.id ?? null,
        })
        .where(eq(userWallet.id, destinationWallet.id));

      await tx.insert(walletTransactions).values([
        {
          id: generateRandomId(),
          type: "DEBIT",
          status: "COMPLETED",
          creditMinute: body.creditMinute,
          reference: body.reference ?? null,
          description:
            body.description ?? "Credit minutes debited from company wallet to user wallet",
          fromOrganizationWalletId: sourceWallet.id,
          toOrganizationWalletId: sourceWallet.id,
          createdByUser: currentUser?.id ?? null,
        },
        {
          id: generateRandomId(),
          type: "CREDIT",
          status: "COMPLETED",
          creditMinute: body.creditMinute,
          reference: body.reference ?? null,
          description:
            body.description ?? "Credit minutes credited to user wallet from company wallet",
          fromUserWalletId: destinationWallet.id,
          toUserWalletId: destinationWallet.id,
          createdByUser: currentUser?.id ?? null,
        },
      ]);

      return tx
        .update(organizationWallet)
        .set({
          updatedByUser: currentUser?.id ?? null,
        })
        .where(eq(organizationWallet.id, sourceWallet.id))
        .returning();
    })
    .catch((error: unknown) => {
      if (error instanceof Error && error.message === "COMPANY_WALLET_NOT_FOUND") {
        return null;
      }
      if (error instanceof Error && error.message.includes("limit reached")) {
        return error.message;
      }
      throw error;
    });

  if (walletResult === null) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "Company wallet not found",
      }),
      404
    );
  }

  if (typeof walletResult === "string") {
    return c.json(
      createErrorResponse({
        error: "Bad Request",
        message: walletResult,
      }),
      400
    );
  }

  return c.json(createSuccessResponse(walletResult[0]), 200);
});
