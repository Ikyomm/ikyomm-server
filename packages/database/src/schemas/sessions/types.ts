export type PodSessionRgb = {
  r: number;
  g: number;
  b: number;
};

export type PodSessionLogPayload =
  | {
      rateMinute?: number;
      rateCredit?: number;
      podId?: string;
      startAt?: string;
      endAt?: string;
    }
  | {
      moodPresetId: string;
    }
  | {
      activeDufuserContainerNumber: number | null;
    }
  | {
      playlistId: string | null;
      musicId: string | null;
      playbackState: "playing" | "paused";
      positionSeconds: number;
      volume: number;
      outputSource: "speaker" | "bluetooth";
      updatedAt: string;
      nonce: string;
    }
  | Record<string, unknown>;
