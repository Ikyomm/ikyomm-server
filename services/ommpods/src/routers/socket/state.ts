import { readPodStateFromRedis, refreshPodStateForPod, type PodState } from "@/pod-state";
import { resolveSessionControlState } from "../shared";

type SessionControlState = Awaited<ReturnType<typeof resolveSessionControlState>>;

export type PodSocketState = PodState & Pick<SessionControlState, "moodPresetId" | "musicControl">;

export async function buildPodSocketState(
  podId: string,
  options: { forceRefresh?: boolean } = {}
): Promise<PodSocketState> {
  const podState = options.forceRefresh
    ? await refreshPodStateForPod(podId)
    : ((await readPodStateFromRedis(podId)) ?? (await refreshPodStateForPod(podId)));

  if (!podState.session) {
    return {
      ...podState,
      moodPresetId: null,
      musicControl: null,
    };
  }

  const controlState = await resolveSessionControlState(podState.session.id);

  return {
    ...podState,
    moodPresetId: controlState.moodPresetId,
    musicControl: controlState.musicControl,
  };
}
