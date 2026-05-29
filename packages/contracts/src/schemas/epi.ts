/**
 * EPI — Empathy Physiological Index (a.k.a. Health Index).
 *
 * Deterministic composite (0–100) computed from canonical twin / internal-load / nutrition
 * signals plus the daily subjective check-in. Feeds the Empathy Coin "efficient day" reward.
 *
 * Canon: the AI never produces these numbers (empathy_generative_core.mdc). Versioned for
 * certification / efficacy studies — see docs/LONGEVITY_FITNESS_INDEX_AND_COIN.md.
 */

import type { IsoDate, IsoDateTime } from "./common";

/** Bump when the formula changes. Stored on every snapshot for reproducibility. */
export const EPI_ALGORITHM_VERSION = "epi_v1" as const;

export type EpiPillarId =
  | "activity_load"
  | "recovery"
  | "hrv"
  | "sleep"
  | "nutrition"
  | "body_composition"
  | "protocol_adherence"
  | "subjective_wellness";

export const EPI_PILLAR_IDS: readonly EpiPillarId[] = [
  "activity_load",
  "recovery",
  "hrv",
  "sleep",
  "nutrition",
  "body_composition",
  "protocol_adherence",
  "subjective_wellness",
] as const;

/** Default weights (sum = 1). Re-normalized across available pillars at compute time. */
export const EPI_PILLAR_WEIGHTS: Record<EpiPillarId, number> = {
  activity_load: 0.16,
  recovery: 0.17,
  hrv: 0.13,
  sleep: 0.14,
  nutrition: 0.12,
  body_composition: 0.08,
  protocol_adherence: 0.1,
  subjective_wellness: 0.1,
};

/** Coverage tier of the composite (drives confidence and certification weighting). */
export type EpiDataTier = "none" | "minimal" | "standard" | "extended";

export type EpiPillarScore = {
  pillar: EpiPillarId;
  /** 0–100 normalized; null when the input is absent. */
  score: number | null;
  /** Effective weight after re-normalization across available pillars. */
  weight: number;
  available: boolean;
  /** Per-pillar input confidence 0–1. */
  confidence: number;
  note?: string;
};

/**
 * Raw inputs for the engine. All optional: missing inputs reduce coverage, never throw.
 * Snake-case-free, already normalized by the resolver.
 */
export type EpiInputs = {
  athleteId: string;
  asOf: IsoDateTime;
  // activity / load
  executionCompliancePct?: number | null;
  fitnessChronic?: number | null;
  activityStreakDays?: number | null;
  // recovery
  readiness?: number | null;
  recoveryCapacity?: number | null;
  autonomicScore?: number | null;
  // hrv
  hrvMs?: number | null;
  hrvBaselineMs?: number | null;
  // sleep
  sleepCircadianScore?: number | null;
  sleepRecovery?: number | null;
  // nutrition
  energyAdequacyRatio?: number | null;
  proteinGPerKg?: number | null;
  // body composition
  bodyFatPct?: number | null;
  phaseAngleScore?: number | null;
  sex?: "male" | "female" | null;
  // protocol adherence
  adherencePct?: number | null;
  hasActivePlan?: boolean | null;
  // subjective check-in (1–5 scales)
  subjEnergy?: number | null;
  subjMood?: number | null;
  subjSleepQuality?: number | null;
  subjSoreness?: number | null;
  subjStress?: number | null;
  /** Illness/symptom flags present for the day. */
  illnessFlags?: string[];
};

/** Snapshot of which inputs were present (audit trail for certification/efficacy). */
export type EpiInputsProvenance = {
  pillarsAvailable: EpiPillarId[];
  pillarsMissing: EpiPillarId[];
  subjectiveCheckinPresent: boolean;
  illnessFlags: string[];
};

export type EpiResult = {
  athleteId: string;
  asOf: IsoDateTime;
  algorithmVersion: typeof EPI_ALGORITHM_VERSION;
  /** 0–100 composite. */
  score: number;
  /** 0–1 overall confidence (coverage-weighted). */
  confidence: number;
  dataTier: EpiDataTier;
  /** Day flagged as malaise/illness → efficiency target suspended. */
  illnessDay: boolean;
  /** Deterministic "efficient day" verdict (drives coin award). */
  efficientDay: boolean;
  /** Coins this day would award (0 on illness day / non-efficient day). */
  coinAwardForDay: number;
  pillars: EpiPillarScore[];
  provenance: EpiInputsProvenance;
};

// ---- Empathy Coin / certification ----

export const COIN_LEDGER_VERSION = "coin_v1" as const;

/** Fixed coin amount for a qualifying efficient day. */
export const COIN_PER_EFFICIENT_DAY = 100;

/** Minimum EPI score for a day to count as "efficient" (when not an illness day). */
export const EPI_EFFICIENT_DAY_MIN_SCORE = 70;

export type EmpathyCoinTier = "bronze" | "silver" | "gold";

export const COIN_TIERS: Record<EmpathyCoinTier, number> = {
  bronze: 10000,
  silver: 25000,
  gold: 50000,
};

/** Highest tier reached for a coin balance, or null below Bronze. */
export function coinTierForBalance(totalCoins: number): EmpathyCoinTier | null {
  if (totalCoins >= COIN_TIERS.gold) return "gold";
  if (totalCoins >= COIN_TIERS.silver) return "silver";
  if (totalCoins >= COIN_TIERS.bronze) return "bronze";
  return null;
}

/** Coins still needed to reach the next tier (null if already gold). */
export function coinsToNextTier(totalCoins: number): { next: EmpathyCoinTier; remaining: number } | null {
  if (totalCoins < COIN_TIERS.bronze) return { next: "bronze", remaining: COIN_TIERS.bronze - totalCoins };
  if (totalCoins < COIN_TIERS.silver) return { next: "silver", remaining: COIN_TIERS.silver - totalCoins };
  if (totalCoins < COIN_TIERS.gold) return { next: "gold", remaining: COIN_TIERS.gold - totalCoins };
  return null;
}

export type EmpathyCoinLedgerEntry = {
  id?: string;
  athleteId: string;
  /** Day the coins were earned for (ISO date). */
  earnedForDate: IsoDate;
  coins: number;
  reason: "efficient_day" | "manual_adjustment" | "recovery_credit";
  epiScore?: number | null;
  ledgerVersion?: string;
  createdAt?: IsoDateTime;
};

export type EmpathyCoinBalance = {
  athleteId: string;
  totalCoins: number;
  tier: EmpathyCoinTier | null;
  nextTier: { next: EmpathyCoinTier; remaining: number } | null;
  efficientDays: number;
};

// ---- Version registry (certification / efficacy audit trail) ----
//
// Single source of truth for *which* algorithm/ledger version produced a stored number, with the
// exact parameters in force at the time. A formula change MUST add a new entry (and bump the
// `*_VERSION` constant) instead of mutating an existing one, so historical snapshots stay
// reproducible and cohorts comparable. See docs/LONGEVITY_FITNESS_EFFICACY_VALIDATION.md.

export type AlgorithmVersionStatus = "active" | "deprecated";

export type EpiAlgorithmVersionInfo = {
  version: string;
  effectiveFrom: IsoDate;
  status: AlgorithmVersionStatus;
  summary: string;
  /** Exact pillar weights this version shipped with (audit copy, not a live reference). */
  pillarWeights: Record<EpiPillarId, number>;
  /** Min EPI score for an efficient day under this version. */
  efficientDayMinScore: number;
  notes?: string;
};

const EPI_V1_VERSION_INFO: EpiAlgorithmVersionInfo = {
  version: EPI_ALGORITHM_VERSION,
  effectiveFrom: "2026-05-01",
  status: "active",
  summary: "8-pillar deterministic composite with coverage re-normalization and illness guard.",
  pillarWeights: { ...EPI_PILLAR_WEIGHTS },
  efficientDayMinScore: EPI_EFFICIENT_DAY_MIN_SCORE,
};

export const EPI_ALGORITHM_REGISTRY: Record<string, EpiAlgorithmVersionInfo> = {
  [EPI_ALGORITHM_VERSION]: EPI_V1_VERSION_INFO,
};

export const CURRENT_EPI_VERSION_INFO: EpiAlgorithmVersionInfo = EPI_V1_VERSION_INFO;

export type CoinLedgerVersionInfo = {
  version: string;
  effectiveFrom: IsoDate;
  status: AlgorithmVersionStatus;
  coinPerEfficientDay: number;
  tiers: Record<EmpathyCoinTier, number>;
  summary: string;
};

const COIN_V1_VERSION_INFO: CoinLedgerVersionInfo = {
  version: COIN_LEDGER_VERSION,
  effectiveFrom: "2026-05-01",
  status: "active",
  coinPerEfficientDay: COIN_PER_EFFICIENT_DAY,
  tiers: { ...COIN_TIERS },
  summary: "Append-only ledger; fixed award per efficient day; Bronze/Silver/Gold thresholds.",
};

export const COIN_LEDGER_REGISTRY: Record<string, CoinLedgerVersionInfo> = {
  [COIN_LEDGER_VERSION]: COIN_V1_VERSION_INFO,
};

export const CURRENT_COIN_VERSION_INFO: CoinLedgerVersionInfo = COIN_V1_VERSION_INFO;

/** Outcome categories the schema is pre-wired to correlate against EPI (efficacy studies). */
export type HealthOutcomeCategory =
  | "work_absence"
  | "illness_episode"
  | "clinical_marker"
  | "self_reported"
  | "other";

export const HEALTH_OUTCOME_CATEGORIES: readonly HealthOutcomeCategory[] = [
  "work_absence",
  "illness_episode",
  "clinical_marker",
  "self_reported",
  "other",
] as const;
