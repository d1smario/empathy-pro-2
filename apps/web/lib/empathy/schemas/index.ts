/**
 * EMPATHY 3.0 — Canonical data model (shared across Data, Engine, Agents, App).
 * Single source of truth for API contracts and frontend.
 */

export * from "./athlete";
export * from "./account";
export * from "./adaptation";
export * from "./physiology";
export * from "./training";
export * from "./nutrition";
export * from "./internal-load";
export * from "./biomarkers";
export * from "./twin";
export * from "./memory";
export * from "./reality";
export type {
  ObservationContextRef,
  ObservationDomain,
  ObservationIngestTags,
  ObservationModality,
} from "@empathy/contracts";
export {
  OBSERVATION_DOMAINS,
  OBSERVATION_MODALITIES,
  isObservationDomain,
  isObservationModality,
} from "@empathy/contracts";
export * from "./knowledge";
export * from "./research";
export * from "./common";
export type {
  AerodynamicsCameraMode,
  AerodynamicsCaptureJobStatus,
  AerodynamicsCaptureJobV1,
  AerodynamicsCaptureSource,
  AerodynamicsCdAEstimate,
  AerodynamicsEquipmentSnapshot,
  AerodynamicsGeometryProfile,
  AerodynamicsOptimizationResult,
  AerodynamicsPositionSnapshot,
  AerodynamicsScores,
  AerodynamicsTestSessionV1,
  AerodynamicsTwinSnapshotV1,
  BiomechanicsCameraPlane,
  BiomechanicsCaptureJobStatus,
  BiomechanicsCaptureJobV1,
  BiomechanicsCaptureSource,
  BiomechanicsDiscipline,
  BiomechanicsEfficiencyScores,
  BiomechanicsJointAngleSample,
  BiomechanicsLandmark3D,
  BiomechanicsMovementPatternSummary,
  BiomechanicsRiskScores,
  BiomechanicsScaleCalibration,
  BiomechanicsSegmentLengths,
  BiomechanicsSessionImportV1,
  BiomechanicsTwinSnapshotV1,
} from "@empathy/contracts";

// Longevity & Fitness / EPI / Coin — canonical source lives in @empathy/contracts.
export type {
  DailyCheckin,
  DailyCheckinScale,
  DailyCheckinSymptom,
  EpiInputs,
  EpiInputsProvenance,
  EpiPillarId,
  EpiPillarScore,
  EpiDataTier,
  EpiResult,
  EmpathyCoinTier,
  EmpathyCoinLedgerEntry,
  EmpathyCoinBalance,
} from "@empathy/contracts";
export {
  DAILY_CHECKIN_SYMPTOMS,
  isDailyCheckinSymptom,
  EPI_ALGORITHM_VERSION,
  EPI_PILLAR_IDS,
  EPI_PILLAR_WEIGHTS,
  COIN_LEDGER_VERSION,
  COIN_PER_EFFICIENT_DAY,
  EPI_EFFICIENT_DAY_MIN_SCORE,
  COIN_TIERS,
  coinTierForBalance,
  coinsToNextTier,
} from "@empathy/contracts";
