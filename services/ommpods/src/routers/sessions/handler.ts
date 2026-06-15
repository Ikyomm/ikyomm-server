import type { AppBindings } from "@/types/app";
import { OpenAPIHono } from "@hono/zod-openapi";
import {
  db,
  podSessionLogs,
  podSessions,
  pods,
  userWallet,
  walletTransactions,
} from "@ikyomm/database";
import {
  createErrorResponse,
  createRequiredAuthSessionMiddleware,
  createSuccessResponse,
  generateRandomId,
  getBetterAuthContext,
  registerOpenApiRoute,
} from "@ikyomm/utils";
import { and, eq, gt, gte, inArray, sql } from "drizzle-orm";
import {
  fetchPodSessionList,
  fetchPodSessionLogList,
  fetchPodSessionTransactionList,
} from "./list";
import {
  buildSessionResponse,
  buildSessionStartingDelay,
  findPodWithAromaDefuser,
  getSessionStartEndDelaySeconds,
  getSessionStartingDelaySeconds,
} from "../shared";
import {
  createSessionRoute,
  deleteSessionRoute,
  emergencyUnlockSessionRoute,
  getSessionRoute,
  getSessionUsageRoute,
  listSessionLogsRoute,
  listSessionsRoute,
  listSessionTransactionsRoute,
  permanentDeleteSessionRoute,
  restoreSessionRoute,
} from "./schema";
import { findPodSessionById, getPodSessionUsage } from "./utils";
import { refreshPollingDataForPod } from "../polling/state";

export const sessionsGroup = new OpenAPIHono<AppBindings>();

const authMiddleware = createRequiredAuthSessionMiddleware({
  entities: {
    user: true,
    session: true,
    data: false,
    organization: false,
    hasOrganization: false,
  },
  enableRedisCache: true,
});

const createWalletLimitMessage = (available: number, requested: number) =>
  `User wallet limit reached. Available: ${available}, requested: ${requested}.`;

registerOpenApiRoute(sessionsGroup, emergencyUnlockSessionRoute, async (c) => {
  const body = c.req.valid("json");
  const now = new Date();
  const unlockWindowSeconds = Math.max(getSessionStartEndDelaySeconds(), 5);
  const sessionEndWindowStart = new Date(now.getTime() - unlockWindowSeconds * 1000);

  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${body.podId}))`);

    const session = await tx.query.podSessions.findFirst({
      where: and(
        eq(podSessions.podId, body.podId),
        inArray(podSessions.status, ["CONFIRMED", "CANCELLED", "EMERGENCY_UNLOCKED"]),
        eq(podSessions.isDeleted, false),
        gt(podSessions.endAt, sessionEndWindowStart)
      ),
      orderBy: (table, { asc }) => [asc(table.endAt)],
      with: {
        pod: {
          with: {
            location: true,
          },
        },
      },
    });

    if (!session) {
      return null;
    }

    if (session.status !== "CONFIRMED" || session.endAt.getTime() <= now.getTime()) {
      return {
        session,
        location: session.pod?.location,
      };
    }

    const [endedSession] = await tx
      .update(podSessions)
      .set({
        status: "EMERGENCY_UNLOCKED",
        endAt: now,
      })
      .where(eq(podSessions.id, session.id))
      .returning();

    return {
      session: endedSession ?? session,
      location: session.pod?.location,
    };
  });

  if (!result) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "Active session not found for this OMMPod",
      }),
      404
    );
  }

  await refreshPollingDataForPod(result.session.podId);

  return c.json(
    createSuccessResponse({
      message: "Emergency unlock completed",
      session: buildSessionResponse(result.session, now, result.location),
    }),
    200
  );
});

sessionsGroup.use("*", authMiddleware);

function getSessionPodId(session: Record<string, unknown>) {
  return typeof session.podId === "string" ? session.podId : null;
}

registerOpenApiRoute(sessionsGroup, listSessionsRoute, async (c) => {
  const query = c.req.valid("query");
  const response = await fetchPodSessionList(query);

  return c.json(createSuccessResponse(response), 200);
});

registerOpenApiRoute(sessionsGroup, getSessionRoute, async (c) => {
  const { id } = c.req.valid("param");
  const session = await findPodSessionById(id, { includeDeleted: true });

  if (!session) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "Session not found",
      }),
      404
    );
  }

  return c.json(createSuccessResponse(session), 200);
});

registerOpenApiRoute(sessionsGroup, listSessionLogsRoute, async (c) => {
  const { id } = c.req.valid("param");
  const query = c.req.valid("query");
  const session = await findPodSessionById(id, { includeDeleted: true });

  if (!session) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "Session not found",
      }),
      404
    );
  }

  const response = await fetchPodSessionLogList(id, query);

  return c.json(createSuccessResponse(response), 200);
});

registerOpenApiRoute(sessionsGroup, listSessionTransactionsRoute, async (c) => {
  const { id } = c.req.valid("param");
  const query = c.req.valid("query");
  const session = await findPodSessionById(id, { includeDeleted: true });

  if (!session) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "Session not found",
      }),
      404
    );
  }

  const response = await fetchPodSessionTransactionList(id, query);

  return c.json(createSuccessResponse(response), 200);
});

registerOpenApiRoute(sessionsGroup, getSessionUsageRoute, async (c) => {
  const { id } = c.req.valid("param");
  const usage = await getPodSessionUsage(id);

  if (!usage) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "Session not found",
      }),
      404
    );
  }

  return c.json(createSuccessResponse(usage), 200);
});

registerOpenApiRoute(sessionsGroup, createSessionRoute, async (c) => {
  const body = c.req.valid("json");
  const { user: currentUser } = getBetterAuthContext(c);

  if (!currentUser) {
    return c.json(
      createErrorResponse({
        error: "Unauthorized",
        message: "Active session not found",
      }),
      401
    );
  }

  const result = await db
    .transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${body.podId}))`);

      const pod = await tx.query.pods.findFirst({
        where: and(eq(pods.id, body.podId), eq(pods.isDeleted, false)),
      });

      if (!pod) {
        throw new Error("POD_NOT_FOUND");
      }

      if (pod.status !== "ACTIVE") {
        throw new Error("POD_NOT_ACTIVE");
      }

      const selectedRateSlab = (pod.rateConfig ?? []).find(
        (slab) => slab.minute === body.rateMinute
      );

      if (!selectedRateSlab) {
        throw new Error("RATE_SLAB_NOT_FOUND");
      }

      const sessionEndWindowStart = new Date(Date.now() - getSessionStartEndDelaySeconds() * 1000);
      const overlappingSession = await tx
        .select({ id: podSessions.id })
        .from(podSessions)
        .where(
          and(
            eq(podSessions.podId, body.podId),
            inArray(podSessions.status, ["CONFIRMED", "CANCELLED", "EMERGENCY_UNLOCKED"]),
            eq(podSessions.isDeleted, false),
            // Future-start sessions hold reservations; recently ended sessions hold the unlock delay.
            gt(podSessions.endAt, sessionEndWindowStart)
          )
        )
        .limit(1)
        .then((rows) => rows[0]);

      if (overlappingSession) {
        throw new Error("POD_SESSION_CONFLICT");
      }

      const [sourceWallet] = await tx
        .select()
        .from(userWallet)
        .where(and(eq(userWallet.userId, currentUser.id), eq(userWallet.isDeleted, false)))
        .limit(1);

      if (!sourceWallet) {
        throw new Error("USER_WALLET_NOT_FOUND");
      }

      const companyId = currentUser.company ?? null;

      const debitedWallets = await tx
        .update(userWallet)
        .set({
          creditMinute: sql`${userWallet.creditMinute} - ${selectedRateSlab.credit}`,
          updatedByUser: currentUser.id,
        })
        .where(
          and(
            eq(userWallet.id, sourceWallet.id),
            gte(userWallet.creditMinute, selectedRateSlab.credit)
          )
        )
        .returning({ id: userWallet.id });

      if (debitedWallets.length === 0) {
        throw new Error(
          createWalletLimitMessage(sourceWallet.creditMinute, selectedRateSlab.credit)
        );
      }

      const now = new Date();
      const startAt = new Date(now.getTime() + getSessionStartingDelaySeconds() * 1000);
      const endAt = new Date(startAt.getTime() + selectedRateSlab.minute * 60_000);
      const sessionId = generateRandomId();
      const debitTransactionId = generateRandomId();

      await tx.insert(walletTransactions).values({
        id: debitTransactionId,
        type: "DEBIT",
        status: "COMPLETED",
        creditMinute: selectedRateSlab.credit,
        reference: sessionId,
        description: "Pod session credits exhausted from user wallet",
        fromUserWalletId: sourceWallet.id,
        toUserWalletId: sourceWallet.id,
        createdByUser: currentUser.id,
      });

      const [session] = await tx
        .insert(podSessions)
        .values({
          id: sessionId,
          podId: body.podId,
          userId: currentUser.id,
          companyId,
          startAt,
          endAt,
          createdByUser: currentUser.id,
        })
        .returning();

      await tx.insert(podSessionLogs).values({
        id: generateRandomId(),
        sessionId,
        eventType: "SESSION_CREATED",
        payload: {
          podId: body.podId,
          rateMinute: selectedRateSlab.minute,
          rateCredit: selectedRateSlab.credit,
          sessionStartingDelay: buildSessionStartingDelay(getSessionStartingDelaySeconds()),
          startAt: startAt.toISOString(),
          endAt: endAt.toISOString(),
        },
        createdByUser: currentUser.id,
      });

      return session;
    })
    .catch((error: unknown) => {
      if (!(error instanceof Error)) {
        throw error;
      }

      if (
        [
          "POD_NOT_FOUND",
          "POD_NOT_ACTIVE",
          "RATE_SLAB_NOT_FOUND",
          "POD_SESSION_CONFLICT",
          "USER_WALLET_NOT_FOUND",
        ].includes(error.message) ||
        error.message.includes("limit reached")
      ) {
        return error.message;
      }

      throw error;
    });

  if (typeof result === "string") {
    const status =
      result === "POD_NOT_FOUND" || result === "USER_WALLET_NOT_FOUND"
        ? 404
        : result === "POD_SESSION_CONFLICT"
          ? 409
          : 400;
    const messages: Record<string, string> = {
      POD_NOT_FOUND: "Pod not found",
      POD_NOT_ACTIVE: "Pod is not active",
      RATE_SLAB_NOT_FOUND: "Selected rate slab not found for this Pod",
      POD_SESSION_CONFLICT: "Pod already has an active or held session",
      USER_WALLET_NOT_FOUND: "User wallet not found",
    };

    return c.json(
      createErrorResponse({
        error: status === 409 ? "Conflict" : status === 404 ? "Not Found" : "Bad Request",
        message: messages[result] ?? result,
      }),
      status
    );
  }

  const responsePod = await findPodWithAromaDefuser(result.podId);
  await refreshPollingDataForPod(result.podId);

  return c.json(
    createSuccessResponse(buildSessionResponse(result, new Date(), responsePod?.location)),
    201
  );
});

registerOpenApiRoute(sessionsGroup, deleteSessionRoute, async (c) => {
  const { id } = c.req.valid("param");
  const { user: currentUser } = getBetterAuthContext(c);

  const existingSession = await findPodSessionById(id, { includeDeleted: true });
  if (!existingSession) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "Session not found",
      }),
      404
    );
  }

  await db
    .update(podSessions)
    .set({
      isDeleted: true,
      deletedAt: new Date(),
      deletedByUser: currentUser?.id ?? null,
      updatedByUser: currentUser?.id ?? null,
    })
    .where(eq(podSessions.id, id));
  const podId = getSessionPodId(existingSession);
  if (podId) {
    await refreshPollingDataForPod(podId);
  }

  return c.json(createSuccessResponse({ message: "Session deleted successfully" }), 200);
});

registerOpenApiRoute(sessionsGroup, permanentDeleteSessionRoute, async (c) => {
  const { id } = c.req.valid("param");

  const existingSession = await findPodSessionById(id, { includeDeleted: true });
  if (!existingSession) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "Session not found",
      }),
      404
    );
  }

  await db.delete(podSessions).where(eq(podSessions.id, id));
  const podId = getSessionPodId(existingSession);
  if (podId) {
    await refreshPollingDataForPod(podId);
  }

  return c.json(
    createSuccessResponse({ message: "Session permanently deleted successfully" }),
    200
  );
});

registerOpenApiRoute(sessionsGroup, restoreSessionRoute, async (c) => {
  const { id } = c.req.valid("param");
  const { user: currentUser } = getBetterAuthContext(c);

  const existingSession = await findPodSessionById(id, { includeDeleted: true });
  if (!existingSession) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "Session not found",
      }),
      404
    );
  }

  await db
    .update(podSessions)
    .set({
      isDeleted: false,
      deletedAt: null,
      deletedByUser: null,
      updatedByUser: currentUser?.id ?? null,
    })
    .where(eq(podSessions.id, id));
  const podId = getSessionPodId(existingSession);
  if (podId) {
    await refreshPollingDataForPod(podId);
  }

  return c.json(createSuccessResponse({ message: "Session restored successfully" }), 200);
});
