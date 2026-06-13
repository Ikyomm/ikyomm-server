import { z } from "@hono/zod-openapi";

export const pollingResponseSchema = z.object({
  podData: z.object({
    connectedDeviceConfig: z.array(
      z.object({
        key: z.string(),
        value: z.string(),
      })
    ),
    aromaDufuser: z.object({
      defuserMacIds: z.array(z.string()),
      activeDefuserMacId: z.string().nullable(),
      activeDufuserContainerNumber: z.number().int().positive().nullable(),
    }),
  }),
  r: z.number().int().min(0).max(255),
  g: z.number().int().min(0).max(255),
  b: z.number().int().min(0).max(255),
  sessionStartingDelay: z
    .object({
      totalTime: z.number().int().min(0),
      remaining: z.number().int().min(0),
    })
    .nullable(),
  sessionEndingDelay: z
    .object({
      totalTime: z.number().int().min(0),
      remaining: z.number().int().min(0),
    })
    .nullable(),
  session: z
    .object({
      id: z.string(),
      podId: z.string(),
      start: z.string(),
      end: z.string(),
      remaining: z.number().int().min(0),
    })
    .nullable(),
});

export type PollingResponse = z.infer<typeof pollingResponseSchema>;
