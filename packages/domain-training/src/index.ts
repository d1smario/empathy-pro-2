/**
 * Builder (canonical single session), calendar operational model, multi-discipline metrics.
 * Boundary: solo tipi e helper deterministici da @empathy/contracts — niente UI.
 */
import type {
  AdaptationTarget,
  DisciplineContext,
  ExecutedWorkout,
  PlannedWorkout,
  TrainingDomain,
} from "@empathy/contracts";

export const DOMAIN = "@empathy/domain-training" as const;
export const DOMAIN_TITLE = "Training";
export const DOMAIN_SUMMARY =
  "Sessione canonica, calendario operativo e carico interno/esterno modellati sui tipi condivisi in @empathy/contracts.";

export type { AdaptationTarget, DisciplineContext, ExecutedWorkout, PlannedWorkout, TrainingDomain };

/** Riga `planned_workouts` da Supabase (snake_case). */
export type PlannedWorkoutDbRow = {
  id: string;
  athlete_id: string;
  date: string;
  type: string;
  duration_minutes: number | string;
  tss_target: number | string;
  kj_target?: number | string | null;
  kcal_target?: number | string | null;
  notes?: string | null;
};

export function plannedWorkoutFromDbRow(row: PlannedWorkoutDbRow): PlannedWorkout {
  const d = typeof row.date === "string" ? row.date : String(row.date);
  return {
    id: row.id,
    athleteId: row.athlete_id,
    date: d.slice(0, 10) as PlannedWorkout["date"],
    type: row.type,
    durationMinutes: Number(row.duration_minutes),
    tssTarget: Number(row.tss_target),
    kjTarget: row.kj_target != null && row.kj_target !== "" ? Number(row.kj_target) : undefined,
    kcalTarget: row.kcal_target != null && row.kcal_target !== "" ? Number(row.kcal_target) : undefined,
    notes: row.notes ?? undefined,
  };
}

/** Riga `executed_workouts` (calendario + analyzer / import tracce). */
export type ExecutedWorkoutDbRow = {
  id: string;
  athlete_id: string;
  date: string;
  duration_minutes: number | string;
  tss: number | string;
  planned_workout_id?: string | null;
  source?: string | null;
  kcal?: number | string | null;
  kj?: number | string | null;
  trace_summary?: Record<string, unknown> | null;
  lactate_mmoll?: number | string | null;
  glucose_mmol?: number | string | null;
  smo2?: number | string | null;
  subjective_notes?: string | null;
  external_id?: string | null;
};

function normalizeExecutedSource(raw: string | null | undefined): NonNullable<ExecutedWorkout["source"]> {
  const s = String(raw ?? "manual").toLowerCase().trim();
  if (s === "garmin" || s === "strava" || s === "manual") return s;
  return "other";
}

function optNum(v: number | string | null | undefined): number | undefined {
  if (v == null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export function executedWorkoutFromDbRow(row: ExecutedWorkoutDbRow): ExecutedWorkout {
  const d = typeof row.date === "string" ? row.date : String(row.date);
  return {
    id: row.id,
    athleteId: row.athlete_id,
    date: d.slice(0, 10) as ExecutedWorkout["date"],
    durationMinutes: Number(row.duration_minutes),
    tss: Number(row.tss),
    plannedWorkoutId: row.planned_workout_id?.trim() || undefined,
    source: normalizeExecutedSource(row.source),
    kcal: optNum(row.kcal ?? undefined),
    kj: optNum(row.kj ?? undefined),
    traceSummary: row.trace_summary ?? null,
    lactateMmoll: optNum(row.lactate_mmoll ?? undefined),
    glucoseMmol: optNum(row.glucose_mmol ?? undefined),
    smo2: optNum(row.smo2 ?? undefined),
    subjectiveNotes: row.subjective_notes?.trim() || undefined,
    externalId: row.external_id?.trim() || undefined,
  };
}

/** Etichetta leggibile per card calendario / lista sedute (deterministico). */
export function formatPlannedWorkoutTitle(workout: PlannedWorkout): string {
  return [workout.type, `${workout.durationMinutes} min`, `TSS ${workout.tssTarget}`].join(" · ");
}

export function formatExecutedWorkoutSummary(workout: ExecutedWorkout): string {
  return [`${workout.durationMinutes} min`, `TSS ${workout.tss}`, workout.source ?? "manual"].join(" · ");
}
