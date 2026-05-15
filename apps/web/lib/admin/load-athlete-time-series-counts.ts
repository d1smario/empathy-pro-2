import type { SupabaseClient } from "@supabase/supabase-js";

const CHUNK = 250;

function num(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) return Number(v);
  return 0;
}

/**
 * Conteggi `athlete_time_series_samples` (055) per atleta — RPC `admin_athlete_time_series_counts` (060).
 */
export async function loadAdminAthleteTimeSeriesCounts(
  admin: SupabaseClient,
  athleteIds: string[],
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const unique = [...new Set(athleteIds.filter(Boolean))];
  if (unique.length === 0) return out;

  for (let i = 0; i < unique.length; i += CHUNK) {
    const chunk = unique.slice(i, i + CHUNK);
    const { data, error } = await admin.rpc("admin_athlete_time_series_counts", { p_athlete_ids: chunk });
    if (error) {
      console.warn("[admin] admin_athlete_time_series_counts RPC skipped:", error.message);
      return out;
    }
    for (const row of (data ?? []) as Array<Record<string, unknown>>) {
      const aid = typeof row.athlete_id === "string" ? row.athlete_id : null;
      if (!aid) continue;
      out.set(aid, num(row.time_series_sample_count));
    }
  }
  return out;
}
