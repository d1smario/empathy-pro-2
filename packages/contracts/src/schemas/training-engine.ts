/**
 * Minimal training-engine unions shared by schemas (e.g. research) without V1 runtime deps.
 * Align with V1 lib/training/engine/types.ts.
 */

export type TrainingDomain =
  | "endurance"
  | "gym"
  | "crossfit"
  | "hyrox"
  | "team_sport"
  | "combat"
  | "mind_body";

export type AdaptationTarget =
  | "mitochondrial_density"
  | "vo2_max_support"
  | "lactate_tolerance"
  | "lactate_clearance"
  | "max_strength"
  | "power_output"
  | "hypertrophy_mixed"
  | "hypertrophy_myofibrillar"
  | "hypertrophy_sarcoplasmic"
  | "neuromuscular_adaptation"
  | "movement_quality"
  | "mobility_capacity"
  | "skill_transfer"
  | "recovery";
