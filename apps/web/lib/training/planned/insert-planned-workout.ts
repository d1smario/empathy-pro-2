import type { SupabaseClient } from "@supabase/supabase-js";
import { clampPlannedWorkoutRow, type PlannedWorkoutInsertPayload } from "@/lib/training/planned/clamp-planned-row";

export function toPlannedWorkoutInsertRecord(row: PlannedWorkoutInsertPayload): Record<string, unknown> {
  const clamped = clampPlannedWorkoutRow(row);
  const payload: Record<string, unknown> = {
    athlete_id: clamped.athlete_id,
    date: clamped.date,
    type: clamped.type,
    duration_minutes: clamped.duration_minutes,
    tss_target: clamped.tss_target,
    kcal_target: clamped.kcal_target,
    notes: clamped.notes,
  };
  if (clamped.kj_target != null) payload.kj_target = clamped.kj_target;
  return payload;
}

export async function insertSinglePlannedWorkout(
  db: SupabaseClient,
  row: PlannedWorkoutInsertPayload,
): Promise<{ id: string | null }> {
  const payload = toPlannedWorkoutInsertRecord(row);
  const { data, error } = await db.from("planned_workouts").insert(payload).select("id").maybeSingle();
  if (error) throw new Error(error.message);
  const id = data && typeof (data as { id?: unknown }).id === "string" ? (data as { id: string }).id : null;
  return { id };
}
