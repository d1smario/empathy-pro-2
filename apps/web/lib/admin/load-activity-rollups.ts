import type { SupabaseClient } from "@supabase/supabase-js";

/** Risposta RPC `admin_athlete_activity_rollups` (migrations 058 + 059). */
export type AdminAthleteActivityRollup = {
  athleteId: string;
  executedWorkoutsCount: number;
  executedLastDate: string | null;
  plannedWorkoutsCount: number;
  plannedLastDate: string | null;
  foodDiaryEntriesCount: number;
  foodDiaryLastEntryDate: string | null;
  biomarkerPanelsCount: number;
  biomarkerLastSampleDate: string | null;
  deviceSyncExportsCount: number;
  deviceSyncLastAt: string | null;
  garminPullJobsTotal: number;
  garminPullJobsCompleted: number;
  garminPullJobsFailed: number;
  garminPullJobsLastAt: string | null;
  garminAthleteLinked: boolean;
  garminActivityBlobsCount: number;
  garminActivityBlobsLastAt: string | null;
  interpretationStagingRunsCount: number;
  interpretationStagingLastAt: string | null;
  trainingImportJobsCount: number;
  trainingImportJobsLastAt: string | null;
};

function num(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) return Number(v);
  return 0;
}

function dateStr(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "string") return v.slice(0, 10);
  return null;
}

function isoTs(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "string") return v;
  return null;
}

function bool(v: unknown): boolean {
  return v === true;
}

/**
 * Batch lettura aggregati atleta (RPC `admin_athlete_activity_rollups`).
 * Se la RPC non esiste o è versione vecchia sul DB, ritorna mappa vuota / campi a zero senza lanciare.
 */
export async function loadAdminAthleteActivityRollups(
  admin: SupabaseClient,
  athleteIds: string[],
): Promise<Map<string, AdminAthleteActivityRollup>> {
  const out = new Map<string, AdminAthleteActivityRollup>();
  const unique = [...new Set(athleteIds.filter(Boolean))];
  if (unique.length === 0) return out;

  const { data, error } = await admin.rpc("admin_athlete_activity_rollups", { p_athlete_ids: unique });
  if (error) {
    console.warn("[admin] admin_athlete_activity_rollups RPC skipped:", error.message);
    return out;
  }

  for (const row of (data ?? []) as Array<Record<string, unknown>>) {
    const aid = typeof row.athlete_id === "string" ? row.athlete_id : null;
    if (!aid) continue;
    out.set(aid, {
      athleteId: aid,
      executedWorkoutsCount: num(row.executed_workouts_count),
      executedLastDate: dateStr(row.executed_last_date),
      plannedWorkoutsCount: num(row.planned_workouts_count),
      plannedLastDate: dateStr(row.planned_last_date),
      foodDiaryEntriesCount: num(row.food_diary_entries_count),
      foodDiaryLastEntryDate: dateStr(row.food_diary_last_entry_date),
      biomarkerPanelsCount: num(row.biomarker_panels_count),
      biomarkerLastSampleDate: dateStr(row.biomarker_last_sample_date),
      deviceSyncExportsCount: num(row.device_sync_exports_count),
      deviceSyncLastAt: isoTs(row.device_sync_last_at),
      garminPullJobsTotal: num(row.garmin_pull_jobs_total),
      garminPullJobsCompleted: num(row.garmin_pull_jobs_completed),
      garminPullJobsFailed: num(row.garmin_pull_jobs_failed),
      garminPullJobsLastAt: isoTs(row.garmin_pull_jobs_last_at),
      garminAthleteLinked: bool(row.garmin_athlete_linked),
      garminActivityBlobsCount: num(row.garmin_activity_blobs_count),
      garminActivityBlobsLastAt: isoTs(row.garmin_activity_blobs_last_at),
      interpretationStagingRunsCount: num(row.interpretation_staging_runs_count),
      interpretationStagingLastAt: isoTs(row.interpretation_staging_last_at),
      trainingImportJobsCount: num(row.training_import_jobs_count),
      trainingImportJobsLastAt: isoTs(row.training_import_jobs_last_at),
    });
  }
  return out;
}
