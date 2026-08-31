import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";
import { logger } from "@/lib/logger";

function normalizeOrigin(origin: string) {
  const trimmedOrigin = origin.trim();

  try {
    const url = new URL(trimmedOrigin);
    url.hostname = url.hostname.replace(/\.+$/, "").toLowerCase();
    return url.origin;
  } catch {
    return trimmedOrigin.replace(/\.+$/, "").toLowerCase();
  }
}

const corsOriginsSchema = z
  .string()
  .min(1, "CORS_ALLOWED_ORIGINS is required")
  .transform((value) =>
    value
      .split(",")
      .map(normalizeOrigin)
      .filter((origin) => origin.length > 0)
  )
  .refine((origins: string[]) => origins.length > 0, {
    message: "CORS_ALLOWED_ORIGINS must contain at least one origin",
  });

export const env = createEnv({
  server: {
    NODE_ENV: z.enum(["development", "test", "production"]),
    PORT: z.coerce.number().int().min(1).max(65535),
    LOG_LEVEL: z.enum(["debug", "info", "warn", "error", "fatal"]),
    LOG_FORMAT: z.enum(["pretty", "json"]),
    CORS_ALLOWED_ORIGINS: corsOriginsSchema,
    DATABASE_URL: z.url("DATABASE_URL must be a valid PostgreSQL connection string"),
    REDIS_URL: z
      .string()
      .min(1, "REDIS_URL is required")
      .refine((val) => /^rediss?:\/\//i.test(val) || /^https?:\/\//i.test(val), {
        message: "REDIS_URL must be a valid Redis connection string",
      }),
    AUTH_SERVICE_URL: z.url("AUTH_SERVICE_URL must be a valid URL — e.g. http://auth:6001"),
    BETTER_AUTH_SECRET: z
      .string()
      .min(16, "BETTER_AUTH_SECRET must be at least 16 characters long"),
    RESEND_API_KEY: z.string().min(1, "RESEND_API_KEY is required for Resend transport"),
    RESEND_FROM_NAME: z.string().trim().min(1, "RESEND_FROM_NAME is required").default("Ikyomm"),
    RESEND_FROM: z.email("RESEND_FROM must be a valid email address"),
    RESEND_TIMEOUT: z.coerce
      .number()
      .int()
      .positive("RESEND_TIMEOUT must be greater than 0")
      .default(12),
  },
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    PORT: process.env.KERNEL_PORT,
    LOG_LEVEL: process.env.LOG_LEVEL,
    LOG_FORMAT: process.env.LOG_FORMAT,
    CORS_ALLOWED_ORIGINS: process.env.CORS_ALLOWED_ORIGINS,
    DATABASE_URL: process.env.DATABASE_URL,
    REDIS_URL: process.env.REDIS_URL,
    AUTH_SERVICE_URL: process.env.AUTH_SERVICE_URL,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    RESEND_FROM_NAME: process.env.RESEND_FROM_NAME,
    RESEND_FROM: process.env.RESEND_FROM,
    RESEND_TIMEOUT: process.env.RESEND_TIMEOUT,
  },
  skipValidation: process.env.SKIP_ENV_VALIDATION === "true",
  onValidationError(issues) {
    logger.fatal("invalid or missing environment variables");
    for (const issue of issues) {
      logger.fatal("env validation issue", {
        path: (issue.path ?? []).join("."),
        message: issue.message,
      });
    }
    logger.fatal("see environment example", {
      exampleFile: "env/.env.example",
    });
    process.exit(1);
  },
});
