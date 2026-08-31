import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

const optionalUrlSchema = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : undefined));

const optionalRedisUrlSchema = optionalUrlSchema.refine(
  (value) => {
    if (!value) {
      return true;
    }

    try {
      return ["redis:", "rediss:", "http:", "https:"].includes(new URL(value).protocol);
    } catch {
      return false;
    }
  },
  {
    message: "REDIS_URL must be a valid Redis connection string",
  }
);

export const env = createEnv({
  server: {
    REDIS_URL: optionalRedisUrlSchema,
    AUTH_SERVICE_URL: optionalUrlSchema.pipe(
      z.url("AUTH_SERVICE_URL must be a valid URL").optional()
    ),
  },

  runtimeEnv: {
    REDIS_URL: process.env.REDIS_URL,
    AUTH_SERVICE_URL: process.env.AUTH_SERVICE_URL,
  },

  skipValidation: process.env.SKIP_ENV_VALIDATION === "true",
});
