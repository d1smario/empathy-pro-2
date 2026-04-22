/**
 * Physiological profile: FTP, soglie, zone, baseline (HRV, temp, glucosio).
 */

import type { IsoDate } from "./common";

export type PhysiologicalProfile = {
  id: string;
  athleteId: string;
  /** Potenza / endurance */
  ftpWatts?: number;
  cpWatts?: number; // Critical power
  lt1Watts?: number;
  lt1HeartRate?: number;
  lt2Watts?: number;
  lt2HeartRate?: number;
  /** Zone (percentuali o assolute); definizione dipende da dominio */
  zones?: PowerZone[] | HeartRateZone[];
  /** Proxy adimensionale glicolitico da motore CP (~0.3–0.8), non V̇La max di laboratorio */
  vLamax?: number;
  vo2maxMlMinKg?: number;
  /** Economia (es. W/L O2) */
  economy?: number;
  /** Baseline per internal load e recovery */
  baselineHrvMs?: number;
  baselineHrvStd?: number;
  baselineTempC?: number;
  baselineGlucoseMmol?: number;
  /** Substrate rates / profilo metabolico se disponibili */
  substrateRates?: Record<string, number>;
  validFrom?: IsoDate;
  validTo?: IsoDate;
  updatedAt?: string;
};

export type PowerZone = {
  name: string;
  lowPct: number;
  highPct: number;
  lowWatts?: number;
  highWatts?: number;
};

export type HeartRateZone = {
  name: string;
  lowBpm: number;
  highBpm: number;
};

export type MetabolicProfile = {
  latestRunAt?: string;
  version?: string;
  ftpWatts?: number;
  cpWatts?: number;
  lt1Watts?: number;
  lt2Watts?: number;
  fatmaxWatts?: number;
  vLamax?: number;
  sprintReserveWatts?: number;
  wPrimeJ?: number;
  pcrCapacityJ?: number;
  glycolyticCapacityJ?: number;
  fitR2?: number;
  fitConfidence?: number;
  fitModel?: string;
  phenotype?: string;
  economy?: number;
  substrateRates?: Record<string, number>;
  substrateTable?: Array<Record<string, unknown>>;
  powerComponents?: Array<Record<string, unknown>>;
  /** Potenze (W) per durata (etichette 5s…20m) dall’ultimo Metabolic Lab salvato — esposta a Training / twin. */
  cpCurveInputsW?: Record<string, number>;
  latestValues?: Record<string, unknown>;
};

export type LactateProfile = {
  latestRunAt?: string;
  version?: string;
  intensityPctFtp?: number;
  energyDemandKcal?: number;
  glycolyticSharePct?: number;
  choKcal?: number;
  nonChoKcal?: number;
  aerobicKcal?: number;
  anaerobicKcal?: number;
  glycogenCombustedGrossG?: number;
  glycogenCombustedNetG?: number;
  lactateProducedG?: number;
  lactateOxidizedG?: number;
  lactateCoriG?: number;
  lactateAccumG?: number;
  lactateFromAnaerobicGlycolysisG?: number;
  lactateFromAerobicGlycolysisG?: number;
  lactateFateOxidationPct?: number;
  lactateFateCoriPct?: number;
  lactateFateAccumPct?: number;
  gutAbsorptionYieldPctOfIngested?: number;
  glucoseFromCoriG?: number;
  glucoseNetFromCoriG?: number;
  coriCostKcal?: number;
  choIngestedTotalG?: number;
  choAfterAbsorptionG?: number;
  microbiotaSequestrationG?: number;
  choIntoBloodstreamG?: number;
  bloodDeliveryPctOfIngested?: number;
  microbiotaPredationPctOfIngested?: number;
  effectiveSequestrationPct?: number;
  microbiotaDysbiosisScore?: number;
  exogenousOxidizedG?: number;
  gutStressScore?: number;
  fermentationLoadScore?: number;
  gutPathwayRisk?: string;
  glucoseRequiredForStrategyG?: number;
  latestValues?: Record<string, unknown>;
};

export type PerformanceProfile = {
  latestRunAt?: string;
  version?: string;
  vo2maxMlMinKg?: number;
  intensityPctFtp?: number;
  oxidativeCapacityKcalMinGross?: number;
  oxidativeCapacityKcalMin?: number;
  requiredKcalMin?: number;
  oxidativeDemandKcalMin?: number;
  aerobicPowerDemandW?: number;
  glycolyticPowerDemandW?: number;
  utilizationRatioPct?: number;
  utilizationVo2CoherencePct?: number;
  utilizationDeliveryStressPct?: number;
  oxidativeBottleneckIndex?: number;
  redoxStressIndex?: number;
  centralDeliveryIndex?: number;
  peripheralUtilizationIndex?: number;
  extractionPct?: number;
  nadhPressureIndex?: number;
  reoxidationCapacityIndex?: number;
  bottleneckType?: string;
  state?: string;
  economy?: number;
  restingHrBpm?: number;
  maxHrBpm?: number;
  latestValues?: Record<string, unknown>;
};

export type RecoveryProfile = {
  baselineHrvMs?: number;
  baselineHrvStd?: number;
  baselineTempC?: number;
  baselineGlucoseMmol?: number;
  restingHrBpm?: number;
  maxHrBpm?: number;
  latestValues?: Record<string, unknown>;
};

export type BioenergeticProfile = {
  source?: string | null;
  phaseAngleScore?: number;
  cellIntegrity?: number;
  mitochondrialEfficiency?: number;
  hydrationStatus?: number;
  inflammationProxy?: number;
  raw?: Record<string, unknown>;
};

export type PhysiologyState = {
  athleteId: string;
  computedAt: string;
  physiologicalProfile: PhysiologicalProfile;
  metabolicProfile: MetabolicProfile;
  lactateProfile: LactateProfile;
  performanceProfile: PerformanceProfile;
  recoveryProfile: RecoveryProfile;
  bioenergeticProfile: BioenergeticProfile;
  sources: {
    physiologicalProfile: boolean;
    metabolicRun: boolean;
    lactateRun: boolean;
    performanceRun: boolean;
    biomarkerPanel: boolean;
  };
};
