import type { IsoDate, IsoDateTime } from "./common";

/**
 * Fenomenologia normalizzata per **serie/eventi** dopo adapter (non routing UI modulo).
 * Distinto da `RealityDomain` (training/sleep/…): qui si descrive *cosa* misura il segnale.
 * Allineamento concettuale: `docs/INGEST_DEVICE_AND_LAB_MATRIX.md`.
 */
export type ObservationDomain =
  | "exertion_mechanical_output"
  | "exertion_physiological_load"
  | "exertion_metabolism_lab"
  | "glucose_continuous"
  | "glucose_discrete"
  | "sleep_timing_duration"
  | "sleep_staging_microstructure"
  | "sleep_respiration_oxygenation"
  | "autonomic_recovery_state"
  | "autonomic_cardiac_rhythm"
  | "thermoregulation"
  | "hydration_electrolytes"
  | "tissue_oxygenation"
  | "respiratory_mechanics"
  | "body_composition"
  | "inflammation_metabolic_blood_panel"
  | "hematology_iron_status"
  | "locomotion_biomechanics"
  | "environmental_exposure"
  | "positioning_navigation"
  | "nutrition_energy_balance_device"
  | "menstrual_cycle_physiology"
  | "subjective_perception"
  | "pain_symptom"
  | "other";

/** Forma del dato nel tempo (una serie può avere una sola modalità primaria; batch possono elencarne più). */
export type ObservationModality =
  | "continuous_stream"
  | "fixed_interval_series"
  | "epoch_summary"
  | "daily_aggregate"
  | "session_aggregate"
  | "event_instantaneous"
  | "specimen_lab";

/**
 * Collegamento logico a contesto senza fondere categorie in un unico bucket "training".
 * Più ref possono coesistere (es. sessione + giorno calendario).
 */
export type ObservationContextRef =
  | { kind: "executed_workout"; executedWorkoutId: string }
  | { kind: "planned_workout"; plannedWorkoutId: string }
  | { kind: "sleep_period"; start: IsoDateTime; end: IsoDateTime }
  | { kind: "calendar_day"; date: IsoDate }
  | { kind: "free_interval"; start: IsoDateTime; end: IsoDateTime };

export const OBSERVATION_DOMAINS = [
  "exertion_mechanical_output",
  "exertion_physiological_load",
  "exertion_metabolism_lab",
  "glucose_continuous",
  "glucose_discrete",
  "sleep_timing_duration",
  "sleep_staging_microstructure",
  "sleep_respiration_oxygenation",
  "autonomic_recovery_state",
  "autonomic_cardiac_rhythm",
  "thermoregulation",
  "hydration_electrolytes",
  "tissue_oxygenation",
  "respiratory_mechanics",
  "body_composition",
  "inflammation_metabolic_blood_panel",
  "hematology_iron_status",
  "locomotion_biomechanics",
  "environmental_exposure",
  "positioning_navigation",
  "nutrition_energy_balance_device",
  "menstrual_cycle_physiology",
  "subjective_perception",
  "pain_symptom",
  "other",
] as const satisfies readonly ObservationDomain[];

export const OBSERVATION_MODALITIES = [
  "continuous_stream",
  "fixed_interval_series",
  "epoch_summary",
  "daily_aggregate",
  "session_aggregate",
  "event_instantaneous",
  "specimen_lab",
] as const satisfies readonly ObservationModality[];

const observationDomainSet = new Set<string>(OBSERVATION_DOMAINS);
const observationModalitySet = new Set<string>(OBSERVATION_MODALITIES);

export function isObservationDomain(value: string): value is ObservationDomain {
  return observationDomainSet.has(value);
}

export function isObservationModality(value: string): value is ObservationModality {
  return observationModalitySet.has(value);
}

/** Metadati opzionali su un batch ingest: etichette multi-dominio + modalità + contesto. */
export type ObservationIngestTags = {
  domains: ObservationDomain[];
  modalities?: ObservationModality[] | null;
  contextRefs?: ObservationContextRef[] | null;
};
