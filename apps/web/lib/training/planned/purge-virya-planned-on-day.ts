import type { SupabaseClient } from "@supabase/supabase-js";
import { VIRYA_NOTES_ILIKE_MARKER } from "@/lib/training/virya/virya-planned-notes";

/**
 * Builder domina VIRYA: rimuove tutte le sedute VIRYA sul giorno prima di materializzare Builder.
 * Evita doppio conteggio in nutrition / meal plan.
 */
export async function purgeViryaPlannedWorkoutsOnDay(
  db: SupabaseClient,
  athleteId: string,
  date: string,
): Promise<{ purgedCount: number }> {
  const dateKey = date.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    return { purgedCount: 0 };
  }
  const { data, error } = await db
    .from("planned_workouts")
    .delete()
    .eq("athlete_id", athleteId)
    .eq("date", dateKey)
    .ilike("notes", VIRYA_NOTES_ILIKE_MARKER)
    .select("id");
  if (error) throw new Error(error.message);
  return { purgedCount: data?.length ?? 0 };
}
