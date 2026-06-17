import type { AromaDefuserContainerType, OmmPodType } from "../enums";

export type PodMoodPresetRgb = {
  r: number;
  g: number;
  b: number;
};

export type PodMoodPresetColor = {
  fixed: string;
  gradient: string;
};

export type PodMoodPresetEnabledPodTypes = OmmPodType[];
export type PodMoodPresetAromaDefuserContainerType = AromaDefuserContainerType;
