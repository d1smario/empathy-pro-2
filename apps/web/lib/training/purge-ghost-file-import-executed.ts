import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Rimuove righe `executed_workouts` da import FIT precedente in modalità «Attività»
 * (durata 0, nessuna serie utile) sullo stesso giorno di un import strutturato PLAN.
 */
export async function purgeGhostFileImportExecutedForDate(
  db: SupabaseClient,
  athleteId: string,
  date: string,
): Promise<{ deleted: number }> {
  const day = date.slice(0, 10);
  const { data, error } = await db
    .from("executed_workouts")
    .select("id, duration_minutes, source")
    .eq("athlete_id", athleteId)
    .eq("date", day);

  if (error) throw new Error(error.message);

  const ids =
    (data ?? [])
      .filter((row) => {
        const src = String(row.source ?? "");
        const dur = Number(row.duration_minutes ?? 0);
        return dur <= 0 && (src === "file_import" || src.startsWith("file_import:"));
      })
      .map((row) => String(row.id)) ?? [];

  if (!ids.length) return { deleted: 0 };

  const { error: delErr } = await db.from("executed_workouts").delete().in("id", ids);
  if (delErr) throw new Error(delErr.message);
  return { deleted: ids.length };
}
