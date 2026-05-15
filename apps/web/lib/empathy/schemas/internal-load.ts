import type { IsoDateTime } from "./common";

export type InternalLoadChannelId =
  | "autonomic"
  | "sleep_circadian"
  | "endocrine"
  | "glycemic"
  | "hydration_cellular"
  | "enteric"
  | "neurocognitive";

export type InternalLoadSignalTrend = "up" | "down" | "stable" | "unknown";
export type InternalLoadChannelStatus = "supported" | "strained" | "compensated" | "unknown";

export type InternalLoadSignal = {
  key: string;
  label: string;
  value?: number | null;
  unit?: string | null;
  baseline?: number | null;
  deviationPct?: number | null;
  zScore?: number | null;
  confidence?: number | null;
  trend?: InternalLoadSignalTrend;
  source?: string | null;
};

export type InternalLoadChannelState = {
  channel: InternalLoadChannelId;
  score: number;
  confidence: number;
  status: InternalLoadChannelStatus;
  notes?: string[];
  signals: InternalLoadSignal[];
};

export type ExpectedAdaptationState = {
  targetLoadScore: number;
  expectedRecoveryCost: number;
  expectedAdaptationScore: number;
  expectedTimeToAbsorbDays?: number | null;
};

export type ObservedAdaptationState = {
  observedRecoveryState: number;
  observedPhysiologicalResponse: number;
  observedBioenergeticResponse: number;
  observedAdaptationScore: number;
};

export type AdaptationDivergenceState = {
  divergenceScore: number;
  direction: "positive" | "neutral" | "negative";
  likelyDrivers: string[];
};

/** Copertura segnali recupero → pesi canali in `resolveInternalLoadState` (Empathy, non vendor). */
export type RecoveryDataTier = "minimal" | "standard" | "extended";

export type InternalLoadState = {
  athleteId: string;
  asOf: IsoDateTime;
  calibrationWindowDays: number;
  acuteWindowDays: number;
  mesoWindowDays: number;
  recoveryDataTier: RecoveryDataTier;
  internalLoadIndex: number;
  recoveryCapacity: number;
  adaptationReadiness: number;
  channels: InternalLoadChannelState[];
  expected: ExpectedAdaptationState;
  observed: ObservedAdaptationState;
  divergence: AdaptationDivergenceState;
};
