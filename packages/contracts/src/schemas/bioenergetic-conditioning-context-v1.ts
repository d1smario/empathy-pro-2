/**
 * Contesto di condizionamento per synthesizer evidenza (24h report giorno).
 * BIA, fluidi, ambiente: valore aggiunto quando disponibili; assenza → coverage bassa.
 */

import type { BioenergeticAnalyteIdV1 } from "./bioenergetic-evidence-shared-v1";

export type BioenergeticTrainingIntensityClassV1 =
  | "z1_z2"
  | "tempo_threshold"
  | "vo2_hi"
  | "neuro_strength"
  | "sprint"
  | "mixed"
  | "unknown";

export type BioenergeticTrainingStimulusWindowV1 = {
  windowId: string;
  startTs: string;
  endTs?: string;
  modality?: string;
  durationMinutes?: number;
  tss?: number;
  plannedVsExecuted?: "planned_only" | "executed_only" | "both";
  intensityClass?: BioenergeticTrainingIntensityClassV1;
  internalLoadHints?: {
    avgHrPctMaxHr?: number;
    trimpLike?: number;
  };
  /** Se false, warning su coupling CHO-sessione. */
  fuelingDeclared?: boolean;
};

export type BioenergeticMealLogQualityV1 = "complete_log" | "partial_macros" | "time_only";

export type BioenergeticNutritionWindowV1 = {
  windowId: string;
  startTs: string;
  endTs?: string;
  carbsG?: number;
  insulinLoad?: number;
  proteinG?: number;
  fatG?: number;
  kcal?: number;
  glycemicLoad?: number;
  proteinLeucineG?: number;
  linksToTrainingWindowIds?: string[];
  mealQuality?: BioenergeticMealLogQualityV1;
};

export type BioenergeticSleepAutonomicWindowV1 = {
  windowId: string;
  startTs: string;
  endTs?: string;
  sleepHours?: number;
  sleepEfficiency01?: number;
  hrvRmssdMs?: number;
};

export type BioenergeticLabAnchorV1 = {
  ts: string;
  analyteId: BioenergeticAnalyteIdV1;
  value: number;
  unit: string;
  provenance: "measured";
  fasting?: boolean;
  assayMethodTag?: string;
};

export type BioenergeticBodyCompositionSourceV1 = "bia_device" | "dexa_reference" | "unknown";

export type BioenergeticBodyCompositionQualityV1 =
  | "fasting_morning"
  | "post_exercise"
  | "arbitrary"
  | "unknown";

/** BIA / impedenza: non interpretazione clinica; input per prior documentate. */
export type BioenergeticBodyCompositionSnapshotV1 = {
  measurementTs: string;
  source: BioenergeticBodyCompositionSourceV1;
  phaseAngleDeg?: number;
  tbwL?: number;
  ecwL?: number;
  icwL?: number;
  ecwTbwRatio?: number;
  rawImpedanceKhz?: Record<string, number>;
  quality: BioenergeticBodyCompositionQualityV1;
  deviceModel?: string;
  athleteStableSessionId?: string;
};

/** Versione modello BIA letteratura → prior operativi (dominio deterministico). */
export const BIOENERGETIC_BIA_LITERATURE_MODEL_VERSION = 1 as const;

/**
 * Bande qualitative da letteratura BIA / idratazione segmentata, **non** diagnosi clinica.
 * Riferimenti concettuali: fase bioelettrica (BIVA / PhA) come proxy geometria cellulare;
 * rapporto ECW/TBW come proxy spostamento verso compartimento extracellulare (contesti clinici e sport).
 */
export type BioenergeticBiaCellularGeometryBandV1 =
  | "insufficient_data"
  | "low_support_cue"
  | "mid"
  | "favourable_geometry_cue";

export type BioenergeticBiaExtracellularFluidBandV1 =
  | "insufficient_data"
  | "favourable_balance"
  | "neutral"
  | "extracellular_shift_cue";

/** Output deterministico del modello letteratura BIA v1 (indici 0–1 operativi + bande). */
export type BioenergeticBiaLiteratureSummaryV1 = {
  modelVersion: typeof BIOENERGETIC_BIA_LITERATURE_MODEL_VERSION;
  /** Affidabilità del prior (0–1): sale con segnali concordi, scende con timing/qualità misura sfavorevole. */
  confidence01: number;
  cellularGeometry: {
    band: BioenergeticBiaCellularGeometryBandV1;
    /** Prior 0–1: supporto “geometria cellulare” vs midpoint popolazione adulta (seso se noto). */
    supportIndex01: number;
    phaseAngleDegUsed?: number;
  };
  extracellularFluid: {
    band: BioenergeticBiaExtracellularFluidBandV1;
    /** Prior 0–1: spostamento verso dominanza extracellulare vs TBW (da ratio o ECW/TBW stimato). */
    loadBias01: number;
    ecwTbwRatioUsed?: number;
  };
  disclaimersIt: string[];
  /** Ancore metodologiche (testo), senza claim diagnostici. */
  literatureAnchorsIt: string[];
};

export type BioenergeticFluidIntakeWindowV1 = {
  windowId: string;
  startTs: string;
  endTs?: string;
  volumeMl?: number;
  sodiumMg?: number;
  linksToTrainingWindowIds?: string[];
};

export type BioenergeticEnvironmentStressV1 = {
  /** Temperatura esterna indicativa (°C) se disponibile. */
  ambientTempC?: number;
  /** Wet-bulb globe o proxy calore. */
  wbgtC?: number;
  relativeHumidityPct?: number;
  altitudeM?: number;
  recentTravel?: boolean;
};

export type BioenergeticSubstanceTimingV1 = {
  windowId: string;
  startTs: string;
  kind: "caffeine" | "alcohol" | "other";
  doseDescription?: string;
};

export type BioenergeticMenstrualCyclePhaseV1 = {
  phase: "menses" | "follicular" | "ovulatory" | "luteal" | "unknown";
  selfReported?: boolean;
};

export type BioenergeticAthletePhenotypeSliceV1 = {
  sex?: "f" | "m" | "unknown";
  trainingStatus?: "sedentary" | "recreational" | "trained" | "elite";
  bodyMassKg?: number;
  primarySport?: string;
};

export type BioenergeticCarryoverFlagsV1 = {
  priorNightSleepIncomplete?: boolean;
  priorDayHighGlycemicLoad?: boolean;
};

export type BioenergeticContextCoverageV1 = {
  training: number;
  nutrition: number;
  sleep: number;
  lab: number;
  hr_stream: number;
  bia: number;
  fluid_intake: number;
  environment: number;
  missingAxes: string[];
};

export type BioenergeticConditioningContextV1 = {
  athleteId: string;
  localDate: string;
  timeZone: string;
  utcOffsetMinutes?: number;
  phenotype?: BioenergeticAthletePhenotypeSliceV1;
  training: BioenergeticTrainingStimulusWindowV1[];
  nutrition: BioenergeticNutritionWindowV1[];
  sleepAutonomic?: BioenergeticSleepAutonomicWindowV1[];
  labAnchors: BioenergeticLabAnchorV1[];
  bodyComposition?: BioenergeticBodyCompositionSnapshotV1;
  /** Prior da modello deterministico BIA↔letteratura (v1); assente se nessuno snapshot analizzabile. */
  biaLiteratureSummary?: BioenergeticBiaLiteratureSummaryV1;
  fluidIntake?: BioenergeticFluidIntakeWindowV1[];
  environment?: BioenergeticEnvironmentStressV1;
  substanceTiming?: BioenergeticSubstanceTimingV1[];
  menstrualCycle?: BioenergeticMenstrualCyclePhaseV1;
  priorDayTrainingLoad?: { tssSum?: number; label?: string };
  carryoverFlags?: BioenergeticCarryoverFlagsV1;
  derivedTags?: string[];
  /** Copertura dati per digest e incertezza (opzionale; calcolata lato assembler). */
  coverage?: BioenergeticContextCoverageV1;
};
