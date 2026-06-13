import type { AppBindings } from "@/types/app";
import { OpenAPIHono } from "@hono/zod-openapi";
import { db, ikyommWallet, user, userWallet, walletTransactions } from "@ikyomm/database";
import {
  createErrorResponse,
  createSuccessResponse,
  generateRandomId,
  getBetterAuthContext,
  registerOpenApiRoute,
} from "@ikyomm/utils";
import { and, eq, gte, isNull, sql } from "drizzle-orm";
import { addCredits, create, get, listTransactions, transferUserCredits } from "./openapi.route";
import { fetchIkyommWalletTransactionList } from "./list";
import { findIkyommWallet } from "./utils";

export const ikyommWalletGroup = new OpenAPIHono<AppBindings>();

const createWalletLimitMessage = (available: number, requested: number) =>
  `Ikyomm wallet limit reached. Available: ${available}, requested: ${requested}.`;

registerOpenApiRoute(ikyommWalletGroup, get, async (c) => {
  const wallet = await findIkyommWallet();

  return c.json(createSuccessResponse(wallet ?? null), 200);
});

registerOpenApiRoute(ikyommWalletGroup, create, async (c) => {
  const body = c.req.valid("json");
  const { user: currentUser } = getBetterAuthContext(c);

  const existingWallet = await findIkyommWallet();
  if (existingWallet) {
    return c.json(createSuccessResponse(existingWallet), 200);
  }

  const [wallet] = await db
    .insert(ikyommWallet)
    .values({
      id: generateRandomId(),
      singletonKey: "ikyomm",
      reference: body.reference ?? null,
      createdByUser: currentUser?.id ?? null,
    })
    .returning();

  return c.json(createSuccessResponse(wallet), 201);
});

registerOpenApiRoute(ikyommWalletGroup, addCredits, async (c) => {
  const body = c.req.valid("json");
  const { user: currentUser } = getBetterAuthContext(c);

  const existingWallet = await findIkyommWallet();
  if (!existingWallet) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "Ikyomm wallet not found",
      }),
      404
    );
  }

  const walletResult = await db
    .transaction(async (tx) => {
      await tx.insert(walletTransactions).values({
        id: generateRandomId(),
        type: body.type,
        status: "COMPLETED",
        creditMinute: body.creditMinute,
        reference: body.reference ?? null,
        description:
          body.description ??
          (body.type === "CREDIT"
            ? "Credit minutes added to Ikyomm wallet"
            : "Credit minutes deducted from Ikyomm wallet"),
        fromIkyommWalletId: existingWallet.id,
        toIkyommWalletId: existingWallet.id,
        createdByUser: currentUser?.id ?? null,
      });

      const nextCreditMinute =
        body.type === "CREDIT"
          ? sql`${ikyommWallet.creditMinute} + ${body.creditMinute}`
          : sql`${ikyommWallet.creditMinute} - ${body.creditMinute}`;

      const nextWallets = await tx
        .update(ikyommWallet)
        .set({
          creditMinute: nextCreditMinute,
          updatedByUser: currentUser?.id ?? null,
        })
        .where(
          and(
            eq(ikyommWallet.id, existingWallet.id),
            body.type === "DEBIT" ? gte(ikyommWallet.creditMinute, body.creditMinute) : undefined
          )
        )
        .returning();

      if (nextWallets.length === 0) {
        throw new Error(createWalletLimitMessage(existingWallet.creditMinute, body.creditMinute));
      }

      return nextWallets;
    })
    .catch((error: unknown) => {
      if (error instanceof Error && error.message.includes("limit reached")) {
        return error.message;
      }
      throw error;
    });

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

registerOpenApiRoute(ikyommWalletGroup, transferUserCredits, async (c) => {
  const { userId } = c.req.valid("param");
  const body = c.req.valid("json");
  const { user: currentUser } = getBetterAuthContext(c);

  const appUser = await db
    .select({ id: user.id })
    .from(user)
    .where(and(eq(user.id, userId), eq(user.isDeleted, false), isNull(user.company)))
    .limit(1);

  if (appUser.length === 0) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "Direct app user not found",
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
        throw new Error(createWalletLimitMessage(sourceWallet.creditMinute, body.creditMinute));
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
            body.description ?? "Credit minutes debited from Ikyomm wallet to user wallet",
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
            body.description ?? "Credit minutes credited to user wallet from Ikyomm wallet",
          fromUserWalletId: destinationWallet.id,
          toUserWalletId: destinationWallet.id,
          createdByUser: currentUser?.id ?? null,
        },
      ]);

      return debitedWallets;
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

registerOpenApiRoute(ikyommWalletGroup, listTransactions, async (c) => {
  const query = c.req.valid("query");
  const response = await fetchIkyommWalletTransactionList(query);

  return c.json(createSuccessResponse(response), 200);
});
