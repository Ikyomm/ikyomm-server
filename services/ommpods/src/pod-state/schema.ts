import { z } from "zod";

export const podStateSchema = z.object({
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
  moodPresetId: z.string().nullable(),
  musicControl: z
    .object({
      playlistId: z.string().nullable(),
      musicId: z.string().nullable(),
      playbackState: z.enum(["playing", "paused"]),
      positionSeconds: z.number().min(0),
      volume: z.number().min(0).max(1),
      outputSource: z.enum(["speaker", "bluetooth"]),
      updatedAt: z.string(),
      nonce: z.string(),
    })
    .nullable(),
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

export type PodState = z.infer<typeof podStateSchema>;
