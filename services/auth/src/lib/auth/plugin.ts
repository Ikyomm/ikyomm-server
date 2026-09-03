import type { BetterAuthPlugin } from "better-auth";
import { APIError } from "better-auth";
import { createAuthEndpoint, createAuthMiddleware } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { z } from "zod";
import { eq } from "drizzle-orm";
import * as schema from "@ikyomm/database";
import { resolveAuthDatabase, resolveEmailExistsCache } from "./utils";

// ─────────────────────────────────────────────
// Email OTP Guard Plugin
// ─────────────────────────────────────────────

// ✅ SELECT id LIMIT 1 — much faster than COUNT(*)
// ✅ Redis cache — skips DB entirely on repeat calls within TTL
function getRequestedPanel(ctx: unknown) {
  const headers =
    (ctx as { headers?: Headers }).headers ??
    (ctx as { request?: { headers?: Headers } }).request?.headers ??
    (ctx as { context?: { headers?: Headers } }).context?.headers;

  return headers?.get("x-auth-panel-scope")?.trim().toLowerCase() ?? null;
}

function canUseEmailFromPanel(requestedPanel: string | null, userPanel: string | null) {
  if (!requestedPanel) {
    return true;
  }

  if (requestedPanel === "ikyomm") {
    return userPanel === "ikyomm";
  }

  if (requestedPanel === "company") {
    return userPanel === "company" || userPanel === "ommpods";
  }

  return true;
}

async function assertEmailExists(email: string, requestedPanel: string | null): Promise<void> {
  const cache = resolveEmailExistsCache();

  const cacheKey = `${requestedPanel ?? "any"}:${email}`;
  const cached = await cache.get(cacheKey);
  if (cached === "1") return;
  if (cached === "0") {
    throw new APIError("BAD_REQUEST", {
      message: "Email not registered. Please sign up first.",
    });
  }

  const [row] = await resolveAuthDatabase()
    .select({ id: schema.user.id, panel: schema.user.panel })
    .from(schema.user)
    .where(eq(schema.user.email, email))
    .limit(1);

  if (!row) {
    await cache.set(cacheKey, "0");
    throw new APIError("BAD_REQUEST", {
      message: "Email not registered. Please sign up first.",
    });
  }

  if (!canUseEmailFromPanel(requestedPanel, row.panel)) {
    await cache.set(cacheKey, "0");
    throw new APIError("FORBIDDEN", {
      message: "This account does not have access to this software.",
    });
  }

  await cache.set(cacheKey, "1");
}

const EMAIL_MUST_EXIST_PATHS = new Set([
  "/email-otp/send-verification-otp",
  "/email-otp/check-verification-otp",
  "/email-otp/verify-email",
  "/sign-in/email-otp",
  "/email-otp/request-password-reset",
  "/forget-password/email-otp",
  "/email-otp/reset-password",
]);

const SESSION_GUARDED_PATHS = new Set([
  "/email-otp/request-email-change",
  "/email-otp/change-email",
]);

export const emailOtpGuardPlugin = {
  id: "email-otp-guard",
  hooks: {
    before: [
      {
        matcher: (ctx: { path?: string }) =>
          !!ctx.path &&
          (EMAIL_MUST_EXIST_PATHS.has(ctx.path) || SESSION_GUARDED_PATHS.has(ctx.path)),
        handler: createAuthMiddleware(async (ctx) => {
          // Session-guarded paths — Better Auth handles auth, skip email check
          if (SESSION_GUARDED_PATHS.has(ctx.path as string)) return;

          const email = (ctx.body as Record<string, string> | undefined)?.email;

          if (!email) {
            throw new APIError("BAD_REQUEST", {
              message: "Email is required.",
            });
          }

          await assertEmailExists(email, getRequestedPanel(ctx));
        }),
      },
    ],
  },
} satisfies BetterAuthPlugin;

// ─────────────────────────────────────────────
// Dedicated App Auth Plugin
// ─────────────────────────────────────────────
export const appAuthPlugin = {
  id: "app-auth",
  endpoints: {
    signInApp: createAuthEndpoint(
      "/app/sign-in",
      {
        method: "POST",
        body: z.object({
          email: z.string().trim().toLowerCase().email(),
        }),
      },
      async (ctx) => {
        const { email } = ctx.body;
        const db = resolveAuthDatabase();
        const [matchedUser] = await db
          .select({
            id: schema.user.id,
            name: schema.user.name,
            email: schema.user.email,
            emailVerified: schema.user.emailVerified,
            role: schema.user.role,
            panel: schema.user.panel,
            company: schema.user.company,
            metadata: schema.user.metadata,
            banned: schema.user.banned,
            banReason: schema.user.banReason,
            createdAt: schema.user.createdAt,
            updatedAt: schema.user.updatedAt,
          })
          .from(schema.user)
          .where(eq(schema.user.email, email))
          .limit(1);

        if (!matchedUser) {
          throw new APIError("UNAUTHORIZED", {
            code: "INVALID_EMAIL_OR_PASSWORD",
            message: "Invalid email or password",
          });
        }

        if (matchedUser.panel !== "app") {
          throw new APIError("FORBIDDEN", {
            code: "FORBIDDEN",
            message: "This account does not have access to the IKYOMM app.",
          });
        }

        if (matchedUser.banned) {
          throw new APIError("FORBIDDEN", {
            code: "FORBIDDEN",
            message: matchedUser.banReason || "Your account has been banned.",
          });
        }

        const session = await ctx.context.internalAdapter.createSession(matchedUser.id);
        if (!session) {
          throw new APIError("INTERNAL_SERVER_ERROR", {
            code: "FAILED_TO_CREATE_SESSION",
            message: "Failed to create session",
          });
        }

        await setSessionCookie(ctx, {
          session,
          user: matchedUser as any,
        });

        return ctx.json({
          token: session.token,
          user: matchedUser,
        });
      }
    ),
  },
} satisfies BetterAuthPlugin;
