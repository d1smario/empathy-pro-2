/**
 * Digital twin state: fitness, fatigue, readiness, metabolic state, adaptation.
 * Updated by events (workout, sleep, HRV, CGM, meals, biomarkers).
 */

import type { IsoDate, IsoDateTime } from "./common";

export type TwinState = {
  athleteId: string;
  /** Data/ora dell'ultimo aggiornamento */
  asOf: IsoDateTime;
  /** Fitness cronico */
  fitnessChronic?: number;
  /** Fatigue acuto */
  fatigueAcute?: number;
  /** Readiness (es. 0–100) */
  readiness?: number;
  /** Recovery debt (giorni o score) */
  recoveryDebt?: number;
  /** Stima glicogeno (arbitraria o % full) */
  glycogenStatus?: number;
  /** Stress autonomico */
  autonomicStrain?: number;
  /** Stress glicolitico (da lattato / proxy) */
  glycolyticStrain?: number;
  /** Collo di bottiglia ossidativo (proxy NADH/NAD+) */
  oxidativeBottleneck?: number;
  /** Redox stress index */
  redoxStressIndex?: number;
  /** Thermal stress */
  thermalStress?: number;
  /** Sleep recovery (qualità/quantità recente) */
  sleepRecovery?: number;
  /** Canonical internal load summary */
  internalLoadIndex?: number;
  recoveryCapacity?: number;
  adaptationReadiness?: number;
  /** Tolleranza GI (se rilevante) */
  giTolerance?: number;
  /** Rischio infiammazione */
  inflammationRisk?: number;
  /** Adaptation score (quanto ci si adatta allo stimolo) */
  adaptationScore?: number;
  /** Adattamento atteso vs reale → divergence */
  expectedAdaptation?: number;
  realAdaptation?: number;
  divergenceScore?: number;
  likelyDrivers?: string[];
  /** Quanto il sistema ha intervenuto (es. riduzione TSS) */
  interventionScore?: number;
  /** Snapshot per date (opzionale, per storico) */
  history?: TwinStateSnapshot[];
};

export type TwinStateSnapshot = TwinState & {
  date: IsoDate;
};
