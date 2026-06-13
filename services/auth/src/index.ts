import { serve } from "@hono/node-server";
import { getDB, initDB, user } from "@ikyomm/database";
import { createHonoRequestLogger } from "@ikyomm/logger";
import {
  applyAppSecurity,
  createErrorHandler,
  createFaviconHandler,
  createHealthCheckHandler,
  createNotFoundHandler,
} from "@ikyomm/utils";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { env } from "@/config/env";
import { startAuthCrons } from "@/crons";
import { initializeAuthSecondaryStorage } from "@/lib/auth/utils";
import { logger } from "@/lib/logger";

const app = new Hono();

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
