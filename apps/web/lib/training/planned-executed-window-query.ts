import type { SupabaseClient } from "@supabase/supabase-js";
import type { DataSourcePreferenceMap } from "@/lib/integrations/data-source-preference";
import { executedWorkoutSourceMatchesPreference, loadDataSourcePreferenceMap } from "@/lib/integrations/data-source-preference";
import {
  dedupePlannedWorkoutDbRows,
  type PlannedWorkoutDbDedupeRow,
} from "@/lib/training/planned/planned-workout-dedupe-fingerprint";

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

function plannedRowsForDedupe(raw: unknown[]): PlannedWorkoutDbDedupeRow[] {
  return raw.map((row) => {
    const r = row as Record<string, unknown>;
    return {
      id: typeof r.id === "string" ? r.id : undefined,
      date: typeof r.date === "string" ? r.date : undefined,
      type: String(r.type ?? "session"),
      duration_minutes: Number(r.duration_minutes ?? 0),
      tss_target: Number(r.tss_target ?? 0),
      kcal_target: r.kcal_target == null || r.kcal_target === "" ? null : Number(r.kcal_target),
      notes: typeof r.notes === "string" ? r.notes : null,
      created_at: typeof r.created_at === "string" ? r.created_at : null,
    };
  });
}

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
  options?: {
    includeTraceSummary?: boolean;
    includePlannedNotes?: boolean;
    /** Calendario: prima solo PLAN in cella, poi fetch EXEC device (default entrambi). */
    includePlanned?: boolean;
    includeExecuted?: boolean;
  },
): Promise<{
  planned: WindowQueryResult;
  executed: WindowQueryResult;
  executedHiddenBySourcePreference: number;
}> {
  const includePlanned = options?.includePlanned !== false;
  const includeExecuted = options?.includeExecuted !== false;
  const prefs =
    includeExecuted && dataSourcePreferences === undefined
      ? await loadDataSourcePreferenceMap(db, athleteId)
      : (dataSourcePreferences ?? {});

  const includeTraceSummary = options?.includeTraceSummary !== false;
  const includePlannedNotes = options?.includePlannedNotes !== false;
  const executedSelect = executedWorkoutsWindowSelect(includeTraceSummary);
  const plannedSelect = plannedWorkoutsWindowSelect(includePlannedNotes);

  const plannedPromise = includePlanned
    ? db
        .from("planned_workouts")
        .select(plannedSelect)
        .eq("athlete_id", athleteId)
        .gte("date", from)
        .lte("date", to)
        .order("date", { ascending: true })
        .range(0, EXECUTED_WINDOW_ROW_LIMIT - 1)
    : Promise.resolve({ data: [] as unknown[], error: null });

  const executedPromise = includeExecuted
    ? db
        .from("executed_workouts")
        .select(executedSelect)
        .eq("athlete_id", athleteId)
        .gte("date", from)
        .lte("date", to)
        .order("date", { ascending: true })
        .range(0, EXECUTED_WINDOW_ROW_LIMIT - 1)
    : Promise.resolve({ data: [] as unknown[], error: null });

  const [planned, executed] = await Promise.all([plannedPromise, executedPromise]);

  const rawExec = (executed.data ?? []) as unknown[];
  const filteredExec = includeExecuted
    ? rawExec.filter((row) => {
        const src = (row as { source?: unknown }).source;
        return executedWorkoutSourceMatchesPreference(prefs, typeof src === "string" ? src : null);
      })
    : [];

  return {
    planned: {
      data: includePlanned ? dedupePlannedWorkoutDbRows(plannedRowsForDedupe(planned.data ?? [])) : [],
      error: planned.error,
    },
    executed: { data: filteredExec, error: executed.error },
    executedHiddenBySourcePreference: includeExecuted ? Math.max(0, rawExec.length - filteredExec.length) : 0,
  };
}

export function firstWindowQueryError(planned: WindowQueryResult, executed: WindowQueryResult): string | null {
  return planned.error?.message ?? executed.error?.message ?? null;
}
