import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";
import { logger } from "@/lib/logger";

const corsOriginsSchema = z
  .string()
  .min(1, "CORS_ALLOWED_ORIGINS is required")
  .transform((value) =>
    value
      .split(",")
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0)
  )
  .refine((origins) => origins.length > 0, {
    message: "CORS_ALLOWED_ORIGINS must contain at least one origin",
  });

/**
 * Typesafe env for the gateway service.
 *
 * Uses @t3-oss/env-core (not env-nextjs) — plain Node/Hono, no Next.js runtime.
 * Validation fires once at process startup and exits cleanly on any failure.
 * During `docker build` set SKIP_ENV_VALIDATION=true; real values arrive at runtime.
 */
export const env = createEnv({
  server: {
    NODE_ENV: z.enum(["development", "test", "production"]),

    PORT: z.coerce.number().int().min(1).max(65535),
    LOG_LEVEL: z.enum(["debug", "info", "warn", "error", "fatal"]),
    LOG_FORMAT: z.enum(["pretty", "json"]),
    CORS_ALLOWED_ORIGINS: corsOriginsSchema,
    AUTH_SERVICE_URL: z.url("AUTH_SERVICE_URL must be a valid URL — e.g. http://auth:6001"),
    KERNEL_SERVICE_URL: z.url("KERNEL_SERVICE_URL must be a valid URL — e.g. http://kernel:6003"),
    COMPANY_SERVICE_URL: z.url(
      "COMPANY_SERVICE_URL must be a valid URL — e.g. http://company:6005"
    ),
    OMMPODS_SERVICE_URL: z.url(
      "OMMPODS_SERVICE_URL must be a valid URL — e.g. http://ommpods:6007"
    ),
    ECOMMERCE_SERVICE_URL: z.url(
      "ECOMMERCE_SERVICE_URL must be a valid URL — e.g. http://ecommerce:6008"
    ),
  },

  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    PORT: process.env.GATEWAY_PORT,
    LOG_LEVEL: process.env.LOG_LEVEL,
    LOG_FORMAT: process.env.LOG_FORMAT,
    CORS_ALLOWED_ORIGINS: process.env.CORS_ALLOWED_ORIGINS,
    AUTH_SERVICE_URL: process.env.AUTH_SERVICE_URL,
    KERNEL_SERVICE_URL: process.env.KERNEL_SERVICE_URL,
    COMPANY_SERVICE_URL: process.env.COMPANY_SERVICE_URL,
    OMMPODS_SERVICE_URL: process.env.OMMPODS_SERVICE_URL,
    ECOMMERCE_SERVICE_URL: process.env.ECOMMERCE_SERVICE_URL,
  },

  skipValidation: process.env.SKIP_ENV_VALIDATION === "true",

  onValidationError(issues) {
    const normalizedIssues = Array.isArray(issues) ? issues : issues;
    logger.fatal("invalid or missing environment variables");
    for (const issue of normalizedIssues) {
      logger.fatal("env validation issue", {
        path: issue.path.join("."),
        message: issue.message,
      });
    }
    logger.fatal("see environment example", {
      exampleFile: "env/.env.example",
    });
    process.exit(1);
  },
});
