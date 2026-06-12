import { z } from "@hono/zod-openapi";

export const MAC_ID_PATTERN =
  /^(?:[0-9A-Fa-f]{12}|[0-9A-Fa-f]{2}([:-])(?:[0-9A-Fa-f]{2}\1){4}[0-9A-Fa-f]{2})$/;

export const normalizeMacId = (value: string): string => {
  const compactValue = value.trim().replace(/[:-]/g, "").toUpperCase();
  return compactValue.match(/.{1,2}/g)?.join(":") ?? compactValue;
};

export const isValidMacId = (value: string): boolean => MAC_ID_PATTERN.test(value.trim());

export const macIdSchema = z
  .string()
  .trim()
  .min(1)
  .refine(isValidMacId, {
    message: "Enter a valid MAC ID, for example AA:BB:CC:DD:EE:FF.",
  })
  .transform(normalizeMacId)
  .openapi({
    description: "Hardware MAC ID in MAC-48 format.",
    example: "AA:BB:CC:DD:EE:FF",
  });
