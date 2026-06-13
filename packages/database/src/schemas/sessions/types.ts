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
  | Record<string, unknown>;
