import type { SupabaseClient } from "@supabase/supabase-js";
import type { DataSourcePreferenceMap } from "@/lib/integrations/data-source-preference";
import { executedWorkoutSourceMatchesPreference, loadDataSourcePreferenceMap } from "@/lib/integrations/data-source-preference";
import { dedupePlannedWorkoutDbRows } from "@/lib/training/planned/planned-workout-dedupe-fingerprint";

/**
 * Select e filtri condivisi tra `GET /api/training/planned-window` e `GET /api/nutrition/module`
 * (stessa finestra `from`…`to` su `planned_workouts` + `executed_workouts`).
 *
 * Opzionale `dataSourcePreferences`: se omesso, carica `athlete_data_source_preference` (053) e,
 * se l’atleta ha scelto un provider per **training_activity**, filtra le righe `executed_workouts`
 * per `source` (prefissi `api_sync:<provider>:` / `manual`). Passa una mappa già caricata (es. da
 * `loadBioenergeticDayMemorySlice`) per evitare una seconda query.
 */
export const PLANNED_WORKOUTS_WINDOW_SELECT =
  "id, athlete_id, date, type, duration_minutes, tss_target, kj_target, kcal_target, notes, created_at" as const;

/** Griglia calendario: metadati senza `notes` (BUILDER_SESSION_JSON può pesare decine di KB per seduta). */
export const PLANNED_WORKOUTS_WINDOW_SELECT_LITE =
  "id, athlete_id, date, type, duration_minutes, tss_target, kj_target, kcal_target, created_at" as const;

export function plannedWorkoutsWindowSelect(includeNotes: boolean): string {
  return includeNotes ? PLANNED_WORKOUTS_WINDOW_SELECT : PLANNED_WORKOUTS_WINDOW_SELECT_LITE;
}

export const EXECUTED_WORKOUTS_WINDOW_SELECT =
  "id, athlete_id, date, started_at, ended_at, duration_minutes, tss, planned_workout_id, source, kcal, kj, trace_summary, lactate_mmoll, glucose_mmol, smo2, subjective_notes, external_id" as const;

/** Calendario griglia: stessi metadati senza `trace_summary` (payload JSON molto più leggero). */
export const EXECUTED_WORKOUTS_WINDOW_SELECT_LITE =
  "id, athlete_id, date, started_at, ended_at, duration_minutes, tss, planned_workout_id, source, kcal, kj, lactate_mmoll, glucose_mmol, smo2, subjective_notes, external_id" as const;

export function executedWorkoutsWindowSelect(includeTraceSummary: boolean): string {
  return includeTraceSummary ? EXECUTED_WORKOUTS_WINDOW_SELECT : EXECUTED_WORKOUTS_WINDOW_SELECT_LITE;
}

/** PostgREST default cap = 1000 righe: alza il tetto per finestre calendario ampie. */
const EXECUTED_WINDOW_ROW_LIMIT = 5000;

type WindowQueryResult = {
  data: unknown[] | null;
  error: { message: string } | null;
};

export async function queryPlannedExecutedWindow(
  db: SupabaseClient,
  athleteId: string,
  from: string,
  to: string,
  dataSourcePreferences?: DataSourcePreferenceMap | null,
  options?: { includeTraceSummary?: boolean; includePlannedNotes?: boolean },
): Promise<{
  planned: WindowQueryResult;
  executed: WindowQueryResult;
  executedHiddenBySourcePreference: number;
}> {
  const prefs =
    dataSourcePreferences === undefined
      ? await loadDataSourcePreferenceMap(db, athleteId)
      : (dataSourcePreferences ?? {});

  const includeTraceSummary = options?.includeTraceSummary !== false;
  const includePlannedNotes = options?.includePlannedNotes !== false;
  const executedSelect = executedWorkoutsWindowSelect(includeTraceSummary);
  const plannedSelect = plannedWorkoutsWindowSelect(includePlannedNotes);

  const [planned, executed] = await Promise.all([
    db
      .from("planned_workouts")
      .select(plannedSelect)
      .eq("athlete_id", athleteId)
      .gte("date", from)
      .lte("date", to)
      .order("date", { ascending: true })
      .range(0, EXECUTED_WINDOW_ROW_LIMIT - 1),
    db
      .from("executed_workouts")
      .select(executedSelect)
      .eq("athlete_id", athleteId)
      .gte("date", from)
      .lte("date", to)
      .order("date", { ascending: true })
      .range(0, EXECUTED_WINDOW_ROW_LIMIT - 1),
  ]);

  const rawExec = (executed.data ?? []) as unknown[];
  const filteredExec = rawExec.filter((row) => {
    const src = (row as { source?: unknown }).source;
    return executedWorkoutSourceMatchesPreference(prefs, typeof src === "string" ? src : null);
  });

  return {
    planned: {
      data: dedupePlannedWorkoutDbRows((planned.data ?? []) as Parameters<typeof dedupePlannedWorkoutDbRows>[0]),
      error: planned.error,
    },
    executed: { data: filteredExec, error: executed.error },
    executedHiddenBySourcePreference: Math.max(0, rawExec.length - filteredExec.length),
  };
}

export function firstWindowQueryError(planned: WindowQueryResult, executed: WindowQueryResult): string | null {
  return planned.error?.message ?? executed.error?.message ?? null;
}
