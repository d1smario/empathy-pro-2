import type { SupabaseClient } from "@supabase/supabase-js";
import { recordArchetypeTraceFromExecuted } from "@/lib/training/library/record-archetype-trace-from-executed";

/** Best-effort wrapper — non propaga errori (ingest executed non bloccante). */
export async function tryRecordArchetypeTraceFromExecuted(input: {
  db: SupabaseClient;
  athleteId: string;
  plannedWorkoutId: string | null | undefined;
  executedWorkoutId: string | null | undefined;
  executedTss: number;
  observedAt?: string;
}): Promise<void> {
  const plannedId = input.plannedWorkoutId?.trim();
  const executedId = input.executedWorkoutId?.trim();
  if (!plannedId || !executedId) return;
  try {
    await recordArchetypeTraceFromExecuted({
      db: input.db,
      athleteId: input.athleteId,
      plannedWorkoutId: plannedId,
      executedWorkoutId: executedId,
      executedTss: input.executedTss,
      observedAt: input.observedAt,
    });
  } catch {
    // degrade silently
  }
}
