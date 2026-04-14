import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Select e filtri condivisi tra `GET /api/training/planned-window` e `GET /api/nutrition/module`
 * (stessa finestra `from`…`to` su `planned_workouts` + `executed_workouts`).
 */
export const PLANNED_WORKOUTS_WINDOW_SELECT =
  "id, athlete_id, date, type, duration_minutes, tss_target, kj_target, kcal_target, notes" as const;

export const EXECUTED_WORKOUTS_WINDOW_SELECT =
  "id, athlete_id, date, duration_minutes, tss, planned_workout_id, source, kcal, kj, trace_summary, lactate_mmoll, glucose_mmol, smo2, subjective_notes, external_id" as const;

type WindowQueryResult = {
  data: unknown[] | null;
  error: { message: string } | null;
};

export async function queryPlannedExecutedWindow(
  db: SupabaseClient,
  athleteId: string,
  from: string,
  to: string,
): Promise<{ planned: WindowQueryResult; executed: WindowQueryResult }> {
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

  return {
    planned: { data: planned.data as unknown[] | null, error: planned.error },
    executed: { data: executed.data as unknown[] | null, error: executed.error },
  };
}

export function firstWindowQueryError(planned: WindowQueryResult, executed: WindowQueryResult): string | null {
  return planned.error?.message ?? executed.error?.message ?? null;
}
