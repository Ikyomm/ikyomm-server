import { serve } from "@hono/node-server";
import {
  account,
  getDB,
  ikyommWallet,
  initDB,
  user,
  userWallet,
  walletTransactions,
} from "@ikyomm/database";
import { createHonoRequestLogger } from "@ikyomm/logger";
import {
  applyAppSecurity,
  createErrorResponse,
  createErrorHandler,
  createFaviconHandler,
  createHealthCheckHandler,
  createNotFoundHandler,
  createSuccessResponse,
  generateRandomId,
  generateUID,
  PasswordUtils,
} from "@ikyomm/utils";
import { and, eq, gte, sql } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { env } from "@/config/env";
import { startAuthCrons } from "@/crons";
import { initializeAuthSecondaryStorage } from "@/lib/auth/utils";
import { logger } from "@/lib/logger";

const app = new Hono();
const APP_SIGNUP_INITIAL_CREDIT_MINUTE = 500;

const appSignUpSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(128),
  name: z.string().trim().min(1),
  metadata: z
    .object({
      age: z.number().int().min(1).max(130).nullable().optional(),
      gender: z.enum(["male", "female", "dont_disclose"]).nullable().optional(),
    })
    .nullable()
    .optional(),
});

const DATABASE_AVAILABILITY_ERROR_CODES = new Set([
  "57014",
  "ETIMEDOUT",
  "ECONNRESET",
  "ENOTFOUND",
  "ECONNREFUSED",
]);

function getErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object") {
    return undefined;
  }

  const code = (error as Record<string, unknown>).code;
  return typeof code === "string" ? code : undefined;
}

function isDatabaseAvailabilityError(error: unknown): boolean {
  let currentError: unknown = error;

  while (currentError && typeof currentError === "object") {
    const code = getErrorCode(currentError);
    if (code && DATABASE_AVAILABILITY_ERROR_CODES.has(code)) {
      return true;
    }

    const message = currentError instanceof Error ? currentError.message.toLowerCase() : "";
    if (
      message.includes("timeout") ||
      message.includes("connection terminated") ||
      message.includes("fetch failed")
    ) {
      return true;
    }

    currentError = (currentError as { cause?: unknown }).cause;
  }

  return false;
}

function createIkyommWalletLimitMessage(available: number) {
  return `Ikyomm wallet limit reached. Available: ${available}, requested: ${APP_SIGNUP_INITIAL_CREDIT_MINUTE}.`;
}

applyAppSecurity(app, {
  corsOrigins: env.CORS_ALLOWED_ORIGINS,
  enableGlobalRateLimit: false,
});
app.use("*", createHonoRequestLogger(logger));

const faviconHandler = createFaviconHandler();
app.get("/health", createHealthCheckHandler({ serviceName: "auth" }));
app.get("/api/auth/health", createHealthCheckHandler({ serviceName: "auth" }));
app.get("/api/auth/check-email-panel", async (c) => {
  const email = c.req.query("email")?.trim().toLowerCase();

  if (!email) {
    return c.json(
      {
        success: false,
        message: "Email is required.",
      },
      400
    );
  }

  let matchedUser: { id: string; panel: string } | undefined;

  try {
    [matchedUser] = await getDB()
      .select({
        id: user.id,
        panel: user.panel,
      })
      .from(user)
      .where(eq(user.email, email))
      .limit(1);
  } catch (error) {
    if (!isDatabaseAvailabilityError(error)) {
      throw error;
    }

    logger.error("email panel lookup failed because database is unavailable", {
      email,
      error,
    });

    throw new HTTPException(503, {
      message: "Database is temporarily unavailable. Please try again shortly.",
    });
  }

  return c.json(
    {
      success: true,
      data: {
        exists: Boolean(matchedUser),
        panel: matchedUser?.panel ?? null,
      },
    },
    200
  );
});
app.post("/api/auth/app/sign-up", async (c) => {
  const payload = await c.req.json().catch(() => null);
  const parsed = appSignUpSchema.safeParse(payload);

  if (!parsed.success) {
    return c.json(
      createErrorResponse({
        error: "Bad Request",
        message: parsed.error.issues[0]?.message ?? "Invalid signup payload.",
      }),
      400
    );
  }

  const body = parsed.data;
  const database = getDB();
  const [existingUser] = await database
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, body.email))
    .limit(1);

  if (existingUser) {
    return c.json(
      createErrorResponse({
        error: "Conflict",
        message: "User with this email already exists",
      }),
      409
    );
  }

  const userId = generateUID();
  const hashedPassword = await PasswordUtils.hash(body.password);
  const signupResult = await database
    .transaction(async (tx) => {
      const [sourceWallet] = await tx
        .select()
        .from(ikyommWallet)
        .where(and(eq(ikyommWallet.singletonKey, "ikyomm"), eq(ikyommWallet.isDeleted, false)))
        .limit(1);

      if (!sourceWallet) {
        throw new Error("IKYOMM_WALLET_NOT_FOUND");
      }

      const debitedWallets = await tx
        .update(ikyommWallet)
        .set({
          creditMinute: sql`${ikyommWallet.creditMinute} - ${APP_SIGNUP_INITIAL_CREDIT_MINUTE}`,
        })
        .where(
          and(
            eq(ikyommWallet.id, sourceWallet.id),
            gte(ikyommWallet.creditMinute, APP_SIGNUP_INITIAL_CREDIT_MINUTE)
          )
        )
        .returning({ id: ikyommWallet.id });

      if (debitedWallets.length === 0) {
        throw new Error(createIkyommWalletLimitMessage(sourceWallet.creditMinute));
      }

      const [createdUser] = await tx
        .insert(user)
        .values({
          id: userId,
          name: body.name,
          email: body.email,
          emailVerified: false,
          role: "user",
          panel: "app",
          company: null,
          metadata: body.metadata ?? null,
        })
        .returning();

      await tx.insert(account).values({
        id: generateRandomId(),
        userId,
        accountId: userId,
        providerId: "credential",
        password: hashedPassword,
      });

      const [createdWallet] = await tx
        .insert(userWallet)
        .values({
          id: generateRandomId(),
          userId,
          creditMinute: APP_SIGNUP_INITIAL_CREDIT_MINUTE,
        })
        .returning();

      await tx.insert(walletTransactions).values([
        {
          id: generateRandomId(),
          type: "DEBIT",
          status: "COMPLETED",
          creditMinute: APP_SIGNUP_INITIAL_CREDIT_MINUTE,
          description: "Signup credits debited from Ikyomm wallet",
          fromIkyommWalletId: sourceWallet.id,
          toIkyommWalletId: sourceWallet.id,
        },
        {
          id: generateRandomId(),
          type: "CREDIT",
          status: "COMPLETED",
          creditMinute: APP_SIGNUP_INITIAL_CREDIT_MINUTE,
          description: "Signup credits credited to app user from Ikyomm wallet",
          fromUserWalletId: createdWallet.id,
          toUserWalletId: createdWallet.id,
        },
      ]);

      return { user: createdUser, wallet: createdWallet };
    })
    .catch((error: unknown) => {
      if (error instanceof Error) {
        if (error.message === "IKYOMM_WALLET_NOT_FOUND") {
          return "IKYOMM_WALLET_NOT_FOUND" as const;
        }

        if (error.message.includes("limit reached")) {
          return error.message;
        }
      }

      if (getErrorCode(error) === "23505") {
        return "EMAIL_CONFLICT" as const;
      }

      throw error;
    });

  if (signupResult === "IKYOMM_WALLET_NOT_FOUND") {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "Ikyomm wallet not found",
      }),
      404
    );
  }

  if (signupResult === "EMAIL_CONFLICT") {
    return c.json(
      createErrorResponse({
        error: "Conflict",
        message: "User with this email already exists",
      }),
      409
    );
  }

  if (typeof signupResult === "string") {
    return c.json(
      createErrorResponse({
        error: "Bad Request",
        message: signupResult,
      }),
      400
    );
  }

  return c.json(
    createSuccessResponse({
      user: {
        id: signupResult.user.id,
        name: signupResult.user.name,
        email: signupResult.user.email,
        emailVerified: signupResult.user.emailVerified,
        role: signupResult.user.role,
        panel: signupResult.user.panel,
        companyId: signupResult.user.company,
        metadata: signupResult.user.metadata ?? null,
      },
      wallet: {
        id: signupResult.wallet.id,
        creditMinute: signupResult.wallet.creditMinute,
      },
    }),
    201
  );
});
app.get("/favicon.png", faviconHandler);
app.get("/favicon.ico", faviconHandler);
app.get("/docs", (c) => c.redirect("/api/auth/docs", 302));
app.get("/", (c) => c.redirect("/docs", 302));

await initDB({ logger, serviceName: "auth" });
startAuthCrons({ logger });
const authModulePromise = import("@/lib/auth");

// Start expensive auth runtime initialization in background to reduce cold-start latency.
const authWarmupPromise = (async () => {
  const { warmAuth } = await authModulePromise;
  await Promise.allSettled([initializeAuthSecondaryStorage(), warmAuth()]);
})().catch((error) => {
  logger.warn("auth runtime warmup failed", {
    error: error instanceof Error ? error.stack : error,
  });
});

app.all("*", async (c) => {
  const { getAuth } = await authModulePromise;
  const auth = await getAuth();
  return auth.handler(c.req.raw);
});
app.notFound(createNotFoundHandler());
app.onError(createErrorHandler({ serviceName: "auth", logger }));

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  logger.info("service started", {
    port: info.port,
    baseUrl: `http://localhost:${info.port}`,
    healthPath: "/health",
  });
});

void authWarmupPromise;

export default app;
