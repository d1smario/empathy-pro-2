import type { SupabaseClient } from "@supabase/supabase-js";
import type { DataSourcePreferenceMap } from "@/lib/integrations/data-source-preference";
import { executedWorkoutSourceMatchesPreference, loadDataSourcePreferenceMap } from "@/lib/integrations/data-source-preference";

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
  "id, athlete_id, date, type, duration_minutes, tss_target, kj_target, kcal_target, notes" as const;

export const EXECUTED_WORKOUTS_WINDOW_SELECT =
  "id, athlete_id, date, started_at, ended_at, duration_minutes, tss, planned_workout_id, source, kcal, kj, trace_summary, lactate_mmoll, glucose_mmol, smo2, subjective_notes, external_id" as const;

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
): Promise<{ planned: WindowQueryResult; executed: WindowQueryResult }> {
  const prefs =
    dataSourcePreferences === undefined
      ? await loadDataSourcePreferenceMap(db, athleteId)
      : (dataSourcePreferences ?? {});

  const [planned, executed] = await Promise.all([
    db
      .from("planned_workouts")
      .select(PLANNED_WORKOUTS_WINDOW_SELECT)
      .eq("athlete_id", athleteId)
      .gte("date", from)
      .lte("date", to)
      .order("date", { ascending: true }),
    db
      .from("executed_workouts")
      .select(EXECUTED_WORKOUTS_WINDOW_SELECT)
      .eq("athlete_id", athleteId)
      .gte("date", from)
      .lte("date", to)
      .order("date", { ascending: true }),
  ]);

  const rawExec = (executed.data ?? []) as unknown[];
  const filteredExec = rawExec.filter((row) => {
    const src = (row as { source?: unknown }).source;
    return executedWorkoutSourceMatchesPreference(prefs, typeof src === "string" ? src : null);
  });

  return {
    planned: { data: planned.data as unknown[] | null, error: planned.error },
    executed: { data: filteredExec, error: executed.error },
  };
}

export function firstWindowQueryError(planned: WindowQueryResult, executed: WindowQueryResult): string | null {
  return planned.error?.message ?? executed.error?.message ?? null;
}
