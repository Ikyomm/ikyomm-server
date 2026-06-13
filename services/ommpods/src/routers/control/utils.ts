import { db, podMoodPresets, podSessionLogs } from "@ikyomm/database";
import { createRequiredAuthSessionMiddleware, generateRandomId } from "@ikyomm/utils";
import { eq } from "drizzle-orm";
import { findContainer } from "../shared";

export const controlAuthMiddleware = createRequiredAuthSessionMiddleware({
  entities: { user: true, session: true, data: false },
  enableRedisCache: true,
});

export async function findActiveMoodPreset(moodPresetId: string) {
  const moodPreset = await db.query.podMoodPresets.findFirst({
    where: eq(podMoodPresets.id, moodPresetId),
  });

  return moodPreset && !moodPreset.isDeleted ? moodPreset : null;
}

export function getAromaValidationError(input: {
  aromaDefuser: Parameters<typeof findContainer>[0];
  activeDufuserContainerNumber: number | null;
}) {
  if (input.activeDufuserContainerNumber === null) {
    return null;
  }

  if (!input.aromaDefuser) {
    return "Pod does not have an Aroma Defuser assigned";
  }

  if (!findContainer(input.aromaDefuser, input.activeDufuserContainerNumber)) {
    return "Aroma Defuser container number not found";
  }

  return null;
}

export async function appendSessionControlLog(input: {
  sessionId: string;
  eventType: "MOOD_CHANGED" | "AROMA_CHANGED";
  payload: Record<string, unknown>;
  createdByUser: string;
}) {
  await db.insert(podSessionLogs).values({
    id: generateRandomId(),
    sessionId: input.sessionId,
    eventType: input.eventType,
    payload: input.payload,
    createdByUser: input.createdByUser,
  });
}
