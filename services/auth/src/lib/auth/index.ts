/** biome-ignore-all lint/suspicious/noExplicitAny: forced */
/** biome-ignore-all assist/source/organizeImports: forced */
import { dash } from "@better-auth/infra";
import { APIError, betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { customSession, emailOTP, openAPI, phoneNumber } from "better-auth/plugins";
import { admin } from "better-auth/plugins/admin";
import { bearer } from "better-auth/plugins/bearer";
import { multiSession } from "better-auth/plugins/multi-session";
import { organization } from "better-auth/plugins/organization";
import { createAuthMiddleware } from "better-auth/api";
import * as schema from "@ikyomm/database";
import {
  getEmailSubject,
  resolveEmailPanel,
  renderPasswordResetOtpEmail,
  renderSignInCodeEmail,
  sendEmail,
} from "@ikyomm/notification";
import { env } from "@/config/env";
import { logger } from "@/lib/logger";
import { userAdditionalFields } from "./fields/user";
import {
  getBetterAuthConfigState,
  normalizeBasePath,
  organizationAdditionalFields,
  resolveAuthUserStatusCache,
  resolveAuthDatabase,
  resolveAuthSecondaryStorage,
} from "./utils";
import { generateRandomId, generateUID, PasswordUtils } from "@ikyomm/utils";
import { emailOtpGuardPlugin, appAuthPlugin } from "./plugin";
import { and, eq, isNull } from "drizzle-orm";

// ─────────────────────────────────────────────
// Config — resolved once at module load
// ─────────────────────────────────────────────

const {
  betterAuthSecret,
  betterAuthUrl,
  betterAuthAllowedHosts,
  cookieSameSite,
  crossSubDomainCookies,
  isProduction,
  trustedOrigins,
} = getBetterAuthConfigState();

type PhoneOtpPayload = {
  phoneNumber: string;
  code: string;
};

type PhoneVerificationPayload = {
  phoneNumber: string;
  user: {
    id: string;
  };
};

type AuthSessionPayload = {
  session: Record<string, unknown> & {
    activeOrganizationId?: string | null;
  };
  user: Record<string, unknown> & {
    id: string;
    banned?: boolean | null;
    banReason?: string | null;
    role?: string | null;
    panel?: string | null;
    metadata?: schema.UserMetadata | null;
  };
};

type VerificationOtpPayload = {
  email: string;
  otp: string;
  type: string;
};

// ─────────────────────────────────────────────
// Auth instance factory
// ─────────────────────────────────────────────

type CachedRolePermissions = {
  data: {
    panel: string | null;
    role: string | null;
    roleId: string | null;
    permissions: Record<string, { accessLevel: string; actions: Record<string, boolean> }>;
  };
  expiresAt: number;
};

const rolePermissionsCache = new Map<string, CachedRolePermissions>();

async function createAuthInstance() {
  // Resolve DB once — reuse across all hooks in this closure
  const db = resolveAuthDatabase();
  const userStatusCache = resolveAuthUserStatusCache();

  return betterAuth({
    appName: "Ikyomm Auth Service",
    baseURL: isProduction
      ? {
          allowedHosts: betterAuthAllowedHosts,
          fallback: betterAuthUrl.origin,
          protocol: "https",
        }
      : betterAuthUrl.origin,
    basePath: normalizeBasePath(betterAuthUrl.pathname),
    secret: betterAuthSecret,
    trustedProxyHeaders: isProduction,
    trustedOrigins,
    database: ((authOptions: any) => {
      const adapter = drizzleAdapter(db, {
        provider: "pg",
        schema,
      })(authOptions);

      return {
        ...adapter,
        async findOne(args: any) {
          const result = await adapter.findOne(args);
          const userResult = result as
            | (Record<string, any> & { id: string; account?: any[] })
            | null
            | undefined;
          if (
            args.model === "user" &&
            userResult &&
            args.join?.account &&
            (!Array.isArray(userResult.account) || userResult.account.length === 0)
          ) {
            const accounts = await db
              .select()
              .from(schema.account)
              .where(eq(schema.account.userId, userResult.id));
            return {
              ...userResult,
              account: accounts,
            };
          }
          return result;
        },
      };
    }) as any,
    experimental: {
      joins: true,
    },
    secondaryStorage: resolveAuthSecondaryStorage(),
    onAPIError: {
      throw: true,
      onError: (error) => {
        logger.error("Ikyomm Auth Service API", {
          error: error instanceof Error ? error.stack : error,
        });

        if (error instanceof APIError) throw error;

        throw new APIError("INTERNAL_SERVER_ERROR", {
          message: "Something went wrong",
        });
      },
    },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
      password: {
        hash: (password) => PasswordUtils.hash(password),
        verify: async ({ password, hash }) => {
          const isValid = await PasswordUtils.verify(password, hash);
          logger.info("Better-Auth password verification attempt", { isValid });
          return isValid;
        },
      },
    },
    emailVerification: {
      sendOnSignUp: false,
      autoSignInAfterVerification: true,
    },
    user: {
      additionalFields: userAdditionalFields,
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30, // 30 days
      updateAge: 60 * 60 * 24, // 24 hours
      deferSessionRefresh: true,
      storeSessionInDatabase: true,
      cookieCache: {
        enabled: false,
        maxAge: 60 * 5,
        strategy: "jwe",
      },
    },
    verification: {
      storeInDatabase: false,
    },
    plugins: [
      bearer(),
      phoneNumber({
        expiresIn: 60 * 5,
        requireVerification: false,
        allowedAttempts: 5,
        sendOTP: ({ phoneNumber, code }: PhoneOtpPayload) => {
          logger.info("Sending OTP", { phoneNumber, code });
        },
        callbackOnVerification: async ({ phoneNumber, user }: PhoneVerificationPayload) => {
          logger.info("Phone number verified", {
            phoneNumber,
            userId: user.id,
          });
        },
      }),
      multiSession({ maximumSessions: 1 }),
      openAPI({
        path: "/docs",
        nonce: env.BETTER_AUTH_SECRET,
        theme: "purple",
      }),
      // dash({ apiKey: env.BETTER_AUTH_API_KEY }),
      organization({
        organizationLimit: 10,
        requireEmailVerificationOnInvitation: false,
        schema: {
          organization: { additionalFields: organizationAdditionalFields },
        },
      }),
      admin({
        defaultRole: "user",
      }),
      customSession(async ({ session, user }: AuthSessionPayload) => {
        const sessionWithOrganization = session as typeof session & {
          activeOrganizationId?: string | null;
        };
        const sessionUser = user as typeof user & {
          banned?: boolean | null;
          banReason?: string | null;
          role?: string | null;
          panel?: string | null;
          metadata?: schema.UserMetadata | null;
        };

        const activeOrganizationId =
          typeof sessionWithOrganization.activeOrganizationId === "string"
            ? sessionWithOrganization.activeOrganizationId
            : null;

        const cachedUserPromise = userStatusCache.get(sessionUser.id);
        const activeMemberPromise = activeOrganizationId
          ? db
              .select({
                role: schema.member.role,
                panel: schema.member.panel,
                organizationId: schema.member.organizationId,
              })
              .from(schema.member)
              .where(
                and(
                  eq(schema.member.userId, sessionUser.id),
                  eq(schema.member.organizationId, activeOrganizationId)
                )
              )
              .limit(1)
              .then((res) => res[0])
          : Promise.resolve(undefined);

        const cachedUser = await cachedUserPromise;

        const liveUser =
          cachedUser ??
          (await (async () => {
            const [dbUser] = await db
              .select({
                id: schema.user.id,
                banned: schema.user.banned,
                banReason: schema.user.banReason,
                role: schema.user.role,
                panel: schema.user.panel,
                metadata: schema.user.metadata,
                updatedAt: schema.user.updatedAt,
              })
              .from(schema.user)
              .where(eq(schema.user.id, sessionUser.id))
              .limit(1);

            if (!dbUser) {
              return null;
            }

            const nextCachedUser = {
              id: dbUser.id,
              banned: Boolean(dbUser.banned),
              banReason: dbUser.banReason,
              role: dbUser.role,
              panel: dbUser.panel,
              metadata: dbUser.metadata,
              updatedAt: dbUser.updatedAt.toISOString(),
            };

            await userStatusCache.set(sessionUser.id, nextCachedUser);
            return nextCachedUser;
          })());

        if (!liveUser) {
          throw new APIError("UNAUTHORIZED", {
            message: "Session user not found.",
          });
        }

        if (liveUser?.banned) {
          throw new APIError("FORBIDDEN", {
            message: liveUser.banReason ?? "Your account has been banned.",
          });
        }

        const activeMember = await activeMemberPromise;

        const userWithTags = {
          ...sessionUser,
          banned: liveUser?.banned ?? sessionUser.banned,
          banReason: liveUser?.banReason ?? sessionUser.banReason,
          role: liveUser?.role ?? sessionUser.role,
          panel: liveUser?.panel ?? sessionUser.panel,
          metadata: liveUser?.metadata ?? sessionUser.metadata ?? null,
        };

        const resolvedRole = activeMember?.role ?? userWithTags.role ?? null;
        const resolvedPanel = activeMember?.panel ?? userWithTags.panel ?? null;

        const roleCacheKey = `${resolvedPanel ?? "none"}:${resolvedRole ?? "none"}:${activeOrganizationId ?? "none"}`;
        const cachedRoleAuth = rolePermissionsCache.get(roleCacheKey);
        const now = Date.now();

        let authorizationResult =
          cachedRoleAuth && cachedRoleAuth.expiresAt > now ? cachedRoleAuth.data : null;

        if (!authorizationResult) {
          const [roleRecord] = resolvedRole
            ? await db
                .select({
                  id: schema.rbacRole.id,
                  panel: schema.rbacRole.panel,
                })
                .from(schema.rbacRole)
                .where(
                  activeMember
                    ? and(
                        eq(schema.rbacRole.panel, "company"),
                        eq(schema.rbacRole.slug, resolvedRole),
                        eq(
                          schema.rbacRole.organizationId,
                          activeMember.organizationId ?? activeOrganizationId
                        )
                      )
                    : and(
                        eq(
                          schema.rbacRole.panel,
                          (resolvedPanel as schema.AccessPanel) ?? "ikyomm"
                        ),
                        eq(schema.rbacRole.slug, resolvedRole),
                        isNull(schema.rbacRole.organizationId)
                      )
                )
                .limit(1)
            : [];

          const permissionRows = roleRecord
            ? await db
                .select({
                  resource: schema.rbacRolePermission.resource,
                  accessLevel: schema.rbacRolePermission.accessLevel,
                  actions: schema.rbacRolePermission.actions,
                })
                .from(schema.rbacRolePermission)
                .where(eq(schema.rbacRolePermission.roleId, roleRecord.id))
            : [];

          authorizationResult = {
            panel: roleRecord?.panel ?? resolvedPanel,
            role: resolvedRole,
            roleId: roleRecord?.id ?? null,
            permissions: Object.fromEntries(
              permissionRows.map((permissionRow) => [
                permissionRow.resource,
                {
                  accessLevel: permissionRow.accessLevel,
                  actions: permissionRow.actions ?? {},
                },
              ])
            ),
          };

          rolePermissionsCache.set(roleCacheKey, {
            data: authorizationResult,
            expiresAt: now + 60_000,
          });
        }

        return {
          session: sessionWithOrganization,
          user: {
            ...userWithTags,
            updatedAt: new Date(liveUser.updatedAt),
          },
          authorization: authorizationResult,
        };
      }),
      // ✅ Guard runs before emailOTP — intercepts before plugin swallows errors
      emailOtpGuardPlugin,
      appAuthPlugin,
      emailOTP({
        expiresIn: 60 * 10, // 10 minutes
        allowedAttempts: 5,
        storeOTP: "hashed",
        overrideDefaultEmailVerification: false,
        async sendVerificationOTP({ email, otp, type }: VerificationOtpPayload) {
          const [emailUser] = await db
            .select({
              panel: schema.user.panel,
            })
            .from(schema.user)
            .where(eq(schema.user.email, email))
            .limit(1);
          const emailPanel = resolveEmailPanel(emailUser?.panel);

          if (type === "sign-in") {
            const subject = getEmailSubject("sign-in", emailPanel);

            await sendEmail({
              to: email,
              subject: subject.subject,
              html: await renderSignInCodeEmail({
                otpCode: otp,
                panel: emailPanel,
                previewText: subject.previewText,
              }),
            });
          }

          if (type === "forget-password") {
            const subject = getEmailSubject("forget-password", emailPanel);

            await sendEmail({
              to: email,
              subject: subject.subject,
              html: await renderPasswordResetOtpEmail({
                otpCode: otp,
                panel: emailPanel,
                previewText: subject.previewText,
              }),
            });
          }
        },
      }),
    ],
    rateLimit: {
      enabled: true,
      window: 60,
      max: 200,
      customRules: {
        "/sign-in/email": { window: 60, max: 40 },
        "/sign-up/email": { window: 60, max: 40 },
        "/email-otp/send-verification-otp": { window: 60, max: 20 },
        "/sign-in/email-otp": { window: 60, max: 20 },
        "/email-otp/request-password-reset": { window: 60, max: 20 },
        "/forget-password/email-otp": { window: 60, max: 20 },
      },
    },
    logger: {
      level: isProduction ? "info" : "debug",
      disabled: false,
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user) => ({
            data: {
              ...user,
              id: generateUID(),
              panel: user.panel ?? "app",
              role: user.role ?? "user",
            },
          }),
        },
        update: {
          after: async (user) => {
            await userStatusCache.del(user.id);
          },
        },
      },
    },
    advanced: {
      crossSubDomainCookies,
      defaultCookieAttributes: {
        sameSite: cookieSameSite,
        secure: isProduction,
        httpOnly: true,
        path: "/",
      },
      database: { generateId: () => generateRandomId() },
      ipAddress: {
        ipAddressHeaders: ["x-forwarded-for", "x-real-ip"],
      },
    },
    hooks: {
      // Enhance the returned user object
      after: createAuthMiddleware(async (ctx) => {
        const path = ctx.path;
        const returned = ctx.context.returned;
        const isAuthPath =
          path === "/sign-in/email" ||
          path === "/sign-up/email" ||
          path === "/sign-in/email-otp" ||
          path === "/two-factor/verify-otp" ||
          path === "/two-factor/verify-totp";

        if (
          isAuthPath &&
          returned &&
          typeof returned === "object" &&
          "user" in returned &&
          returned.user &&
          typeof returned.user === "object" &&
          "id" in returned.user
        ) {
          const userId = returned.user.id as string;

          const [user] = await db
            .select({
              id: schema.user.id,
              email: schema.user.email,
              role: schema.user.role,
              emailVerified: schema.user.emailVerified,
              memberId: schema.member.id,
              banned: schema.user.banned,
              ban: schema.user.banReason,
              panel: schema.user.panel,
              metadata: schema.user.metadata,
              // employee details
              employeeId: schema.user.employeeId,
              employeeEmail: schema.user.employeeEmail,

              // location details
              country: schema.user.country,
              state: schema.user.state,
              city: schema.user.city,
            })
            .from(schema.user)
            .leftJoin(schema.member, eq(schema.user.id, schema.member.userId))
            .where(eq(schema.user.id, userId))
            .limit(1);

          if (user) {
            returned.user = {
              ...user,
              hasOrganization: !!user.memberId,
            };
          }
        }

        return returned;
      }),
    },
  });
}

let authInstance: BetterAuthInstance | null = null;
let authInitializationPromise: Promise<BetterAuthInstance> | null = null;

async function initializeAuthInstance(): Promise<BetterAuthInstance> {
  if (authInstance) {
    return authInstance;
  }

  if (authInitializationPromise) {
    return authInitializationPromise;
  }

  authInitializationPromise = (async () => {
    const nextAuthInstance = await createAuthInstance();
    authInstance = nextAuthInstance;
    return nextAuthInstance;
  })();

  try {
    return await authInitializationPromise;
  } finally {
    authInitializationPromise = null;
  }
}

export async function warmAuth() {
  await initializeAuthInstance();
}

export async function getAuth() {
  return initializeAuthInstance();
}

export type BetterAuthInstance = Awaited<ReturnType<typeof createAuthInstance>>;
