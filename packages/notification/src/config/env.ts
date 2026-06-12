import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    EMAIL_PREVIEW_PORT: z.coerce.number().int().min(1).max(65535).default(3005),
    RESEND_API_KEY: z.string().min(1, "RESEND_API_KEY is required"),
    RESEND_FROM_NAME: z.string().trim().min(1, "RESEND_FROM_NAME is required").default("Ikyomm"),
    RESEND_FROM: z
      .string()
      .email("RESEND_FROM must be a valid email address")
      .min(1, "RESEND_FROM is required"),
    RESEND_TIMEOUT: z.coerce
      .number()
      .int()
      .positive("RESEND_TIMEOUT must be greater than 0")
      .default(12),
  },

  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    EMAIL_PREVIEW_PORT: process.env.EMAIL_PREVIEW_PORT,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    RESEND_FROM_NAME: process.env.RESEND_FROM_NAME,
    RESEND_FROM: process.env.RESEND_FROM,
    RESEND_TIMEOUT: process.env.RESEND_TIMEOUT,
  },

  skipValidation: process.env.SKIP_ENV_VALIDATION === "true",
});
