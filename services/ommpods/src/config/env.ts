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
  .refine((origins) => origins.length > 0, {
    message: "CORS_ALLOWED_ORIGINS must contain at least one origin",
  });

const booleanStringSchema = z
  .enum(["true", "false", "1", "0"])
  .transform((value) => value === "true" || value === "1");

export const env = createEnv({
  server: {
    NODE_ENV: z.enum(["development", "test", "production"]),
    PORT: z.coerce.number().int().min(1).max(65535),
    LOG_LEVEL: z.enum(["debug", "info", "warn", "error", "fatal"]),
    LOG_FORMAT: z.enum(["pretty", "json"]),
    CORS_ALLOWED_ORIGINS: corsOriginsSchema,
    DATABASE_URL: z.url("DATABASE_URL must be a valid PostgreSQL connection string"),
    REDIS_URL: z.url("REDIS_URL must be a valid Redis connection string"),
    AUTH_SERVICE_URL: z.url("AUTH_SERVICE_URL must be a valid URL - e.g. http://auth:6001"),
    BETTER_AUTH_SECRET: z
      .string()
      .min(16, "BETTER_AUTH_SECRET must be at least 16 characters long"),
    SESSION_START_END_DELAY_SECONDS: z.coerce.number().int().min(0).default(20),
    SESSION_START_INTRODUCTORY_VIDEO_DURATION: z.coerce.number().int().min(0).default(30),
    MQTT_ENABLED: booleanStringSchema.default(false),
    MQTT_SERVER: z.string().min(1).default("172.105.41.17"),
    MQTT_PORT: z.coerce.number().int().min(1).max(65_535).default(1883),
    MQTT_WS_PORT: z.coerce.number().int().min(1).max(65_535).default(9001),
    MQTT_CLIENT_ID_PREFIX: z.string().min(1).default("ommpods-service"),
    MQTT_STATUS_TOPIC: z.string().min(1).default("ommpod/pod/status"),
    MQTT_QOS: z.coerce.number().int().min(0).max(2).default(1),
  },
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    PORT: process.env.OMMPODS_PORT,
    LOG_LEVEL: process.env.LOG_LEVEL,
    LOG_FORMAT: process.env.LOG_FORMAT,
    CORS_ALLOWED_ORIGINS: process.env.CORS_ALLOWED_ORIGINS,
    DATABASE_URL: process.env.DATABASE_URL,
    REDIS_URL: process.env.REDIS_URL,
    AUTH_SERVICE_URL: process.env.AUTH_SERVICE_URL,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    SESSION_START_END_DELAY_SECONDS: process.env.OMMPODS_SESSION_START_END_DELAY_SECONDS,
    SESSION_START_INTRODUCTORY_VIDEO_DURATION:
      process.env.OMMPODS_SESSION_START_INTRODUCTORY_VIDEO_DURATION,
    MQTT_ENABLED: process.env.OMMPODS_MQTT_ENABLED,
    MQTT_SERVER: process.env.OMMPODS_MQTT_SERVER,
    MQTT_PORT: process.env.OMMPODS_MQTT_PORT,
    MQTT_WS_PORT: process.env.OMMPODS_MQTT_WS_PORT,
    MQTT_CLIENT_ID_PREFIX: process.env.OMMPODS_MQTT_CLIENT_ID_PREFIX,
    MQTT_STATUS_TOPIC: process.env.OMMPODS_MQTT_STATUS_TOPIC,
    MQTT_QOS: process.env.OMMPODS_MQTT_QOS,
  },
  skipValidation: process.env.SKIP_ENV_VALIDATION === "true",
  onValidationError(issues) {
    logger.fatal("invalid or missing environment variables in ommpods service");
    for (const issue of issues) {
      logger.fatal("env validation issue", {
        path: (issue.path ?? []).join("."),
        message: issue.message,
      });
    }
    process.exit(1);
  },
});
