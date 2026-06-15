import { readPollingDataFromRedis, refreshPollingDataForPod } from "../polling/state";
import type { PollingResponse } from "../polling/schema";
import { resolveSessionControlState } from "../shared";

type SessionControlState = Awaited<ReturnType<typeof resolveSessionControlState>>;

export type PodSocketState = PollingResponse &
  Pick<SessionControlState, "moodPresetId" | "musicControl">;

export async function buildPodSocketState(
  podId: string,
  options: { forceRefresh?: boolean } = {}
): Promise<PodSocketState> {
  const pollingState = options.forceRefresh
    ? await refreshPollingDataForPod(podId)
    : ((await readPollingDataFromRedis(podId)) ?? (await refreshPollingDataForPod(podId)));

  if (!pollingState.session) {
    return {
      ...pollingState,
      moodPresetId: null,
      musicControl: null,
    };
  }

  const controlState = await resolveSessionControlState(pollingState.session.id);

  return {
    ...pollingState,
    moodPresetId: controlState.moodPresetId,
    musicControl: controlState.musicControl,
  };
}
