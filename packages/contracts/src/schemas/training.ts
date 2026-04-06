/**
 * Planned vs Executed workout; external vs internal load series.
 */

import type { IsoDate, IsoDateTime, LoadSeriesPoint } from "./common";

export type PlannedWorkout = {
  id: string;
  athleteId: string;
  date: IsoDate;
  /** Tipo seduta (es. endurance, threshold, vo2max, recovery) */
  type: string;
  durationMinutes: number;
  tssTarget: number;
  kjTarget?: number;
  kcalTarget?: number;
  /** Distribuzione per zone (es. Z1 60%, Z2 30%, Z3 10%) */
  zoneSplit?: Record<string, number>;
  /** Obiettivo adattativo (es. "aerobic base", "lactate clearance") */
  adaptiveGoal?: string;
  /** Note per VIRYA / agent */
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type ExecutedWorkout = {
  id: string;
  athleteId: string;
  plannedWorkoutId?: string | null;
  date: IsoDate;
  startedAt?: IsoDateTime;
  endedAt?: IsoDateTime;
  durationMinutes: number;
  tss: number;
  kj?: number;
  kcal?: number;
  /**
   * Riepilogo + serie da import (FIT/GPX/TCX/JSON/CSV): chiavi canonical come V1
   * (`power_series_w`, `route_points`, `channels_available`, …).
   */
  traceSummary?: Record<string, unknown> | null;
  /** Dati opzionali da device/sensori */
  lactateMmoll?: number;
  glucoseMmol?: number;
  smo2?: number;
  /** Note soggettive (RPE, sensazione) */
  subjectiveNotes?: string;
  source?: "manual" | "garmin" | "strava" | "other";
  externalId?: string;
  createdAt?: string;
  updatedAt?: string;
};

/** Storico carico esterno: ATL, CTL, TSB (e opzionale std) */
export type ExternalLoadSeries = LoadSeriesPoint[];

/** Storico carico interno: ATL, CTL, TSB + std personale, z-score, decoupling */
export type InternalLoadSeries = LoadSeriesPoint[];

export type PlannedVsActualDelta = {
  plannedWorkoutId: string;
  executedWorkoutId: string;
  durationDeltaMinutes: number;
  tssDelta: number;
  kcalDelta: number;
  /** Flag per trigger adattamento (es. |delta| > soglia) */
  requiresAdaptation: boolean;
};
