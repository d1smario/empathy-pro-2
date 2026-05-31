import type { SupabaseClient } from "@supabase/supabase-js";
import type { ExecutedWorkout, PlannedWorkout } from "@empathy/contracts";
import { executedWorkoutFromDbRow, plannedWorkoutFromDbRow, type ExecutedWorkoutDbRow, type PlannedWorkoutDbRow } from "@empathy/domain-training";
import { filterDeviceExportsByAthleteDataSourcePreference } from "@/lib/bioenergetics/bioenergetic-device-exports-preference-filter";
import { filterDeviceExportsForPanelDate } from "@/lib/bioenergetics/bioenergetic-device-exports-panel-date";
import { loadDataSourcePreferenceMap } from "@/lib/integrations/data-source-preference";
import { EMPTY_NUTRITION_PLAN_DAY, type NutritionPlanDayContext } from "@/lib/bioenergetics/nutrition-plan-day-empty";
import { loadNutritionPlanDayContext } from "@/lib/bioenergetics/load-nutrition-plan-for-day";
import { firstWindowQueryError, queryPlannedExecutedWindow } from "@/lib/training/planned-executed-window-query";

export type BioenergeticDayMemorySlice = {
  athleteId: string;
  date: string;
  planned: PlannedWorkout[];
  executed: ExecutedWorkout[];
  diaryRows: Array<Record<string, unknown>>;
  biomarkerRows: Array<Record<string, unknown>>;
  /** Export il cui giorno logico (wellness / payload) coincide con `date`. */
  deviceExportRows: Array<Record<string, unknown>>;
  /** Campioni time-series canonici (055) per `date` locale (CGM / lattato). */
  timeSeriesSamplesRows?: Array<Record<string, unknown>>;
  /** Macro pasti da `nutrition_plans` o solver training (Reality > Plan per fase predittiva). */
  nutritionPlan: NutritionPlanDayContext;
};

function addDaysIsoDate(date: string, deltaDays: number): string {
  const base = new Date(`${date.slice(0, 10)}T12:00:00.000Z`);
  if (Number.isNaN(base.getTime())) return date.slice(0, 10);
  base.setUTCDate(base.getUTCDate() + deltaDays);
  return base.toISOString().slice(0, 10);
}

/** Esporta per test: re-export da modulo senza dipendenze server-only. */
export { filterDeviceExportsForPanelDate } from "@/lib/bioenergetics/bioenergetic-device-exports-panel-date";

/**
 * Carica la fetta di memoria operativa per una giornata ISO (stesse tabelle canoniche,
 * export device filtrati con `wellnessExportMatchesPanelDate` oltre al range `created_at`).
 */
export async function loadBioenergeticDayMemorySlice(
  db: SupabaseClient,
  athleteId: string,
  date: string,
): Promise<{ slice: BioenergeticDayMemorySlice; queryError: string | null }> {
  const dateKey = date.slice(0, 10);
  const exportFrom = addDaysIsoDate(dateKey, -2);
  const exportTo = addDaysIsoDate(dateKey, 3);

  const prefMap = await loadDataSourcePreferenceMap(db, athleteId);

  const [windowRes, diaryRes, exportsRes, biomarkersRes, timeSeriesRes] = await Promise.all([
    queryPlannedExecutedWindow(db, athleteId, dateKey, dateKey, prefMap),
    db
      .from("food_diary_entries")
      .select(
        "id, entry_date, entry_time, meal_slot, food_label, quantity_g, carbs_g, protein_g, fat_g, kcal, sodium_mg, insulin_load, glycemic_index_estimate, glycemic_load",
      )
      .eq("athlete_id", athleteId)
      .eq("entry_date", dateKey)
      .order("entry_time", { ascending: true }),
    db
      .from("device_sync_exports")
      .select("id, provider, payload, created_at")
      .eq("athlete_id", athleteId)
      .gte("created_at", `${exportFrom}T00:00:00`)
      .lte("created_at", `${exportTo}T23:59:59`)
      .order("created_at", { ascending: true }),
    db
      .from("biomarker_panels")
      .select("id, sample_date, values, created_at")
      .eq("athlete_id", athleteId)
      .eq("sample_date", dateKey),
    db
      .from("athlete_time_series_samples")
      .select("id, observed_at, channel, value, unit, quality, source, source_ref, created_at")
      .eq("athlete_id", athleteId)
      .gte("observed_at", `${dateKey}T00:00:00.000Z`)
      .lte("observed_at", `${dateKey}T23:59:59.999Z`)
      .order("observed_at", { ascending: true }),
  ]);

  const windowErr = firstWindowQueryError(windowRes.planned, windowRes.executed);
  if (windowErr) {
    return {
      slice: {
        athleteId,
        date: dateKey,
        planned: [],
        executed: [],
        diaryRows: [],
        biomarkerRows: [],
        deviceExportRows: [],
        timeSeriesSamplesRows: [],
        nutritionPlan: EMPTY_NUTRITION_PLAN_DAY,
      },
      queryError: windowErr,
    };
  }
  if (diaryRes.error) {
    return {
      slice: {
        athleteId,
        date: dateKey,
        planned: [],
        executed: [],
        diaryRows: [],
        biomarkerRows: [],
        deviceExportRows: [],
        timeSeriesSamplesRows: [],
        nutritionPlan: EMPTY_NUTRITION_PLAN_DAY,
      },
      queryError: diaryRes.error.message,
    };
  }
  if (exportsRes.error) {
    return {
      slice: {
        athleteId,
        date: dateKey,
        planned: [],
        executed: [],
        diaryRows: [],
        biomarkerRows: [],
        deviceExportRows: [],
        timeSeriesSamplesRows: [],
        nutritionPlan: EMPTY_NUTRITION_PLAN_DAY,
      },
      queryError: exportsRes.error.message,
    };
  }
  if (biomarkersRes.error) {
    return {
      slice: {
        athleteId,
        date: dateKey,
        planned: [],
        executed: [],
        diaryRows: [],
        biomarkerRows: [],
        deviceExportRows: [],
        timeSeriesSamplesRows: [],
        nutritionPlan: EMPTY_NUTRITION_PLAN_DAY,
      },
      queryError: biomarkersRes.error.message,
    };
  }
  if (timeSeriesRes.error) {
    return {
      slice: {
        athleteId,
        date: dateKey,
        planned: [],
        executed: [],
        diaryRows: [],
        biomarkerRows: [],
        deviceExportRows: [],
        timeSeriesSamplesRows: [],
        nutritionPlan: EMPTY_NUTRITION_PLAN_DAY,
      },
      queryError: timeSeriesRes.error.message,
    };
  }

  const planned = ((windowRes.planned.data ?? []) as PlannedWorkoutDbRow[]).map(plannedWorkoutFromDbRow);
  const executed = ((windowRes.executed.data ?? []) as ExecutedWorkoutDbRow[]).map(executedWorkoutFromDbRow);
  const diaryRows = (diaryRes.data ?? []) as Array<Record<string, unknown>>;
  const biomarkerRows = (biomarkersRes.data ?? []) as Array<Record<string, unknown>>;
  const exportCandidatesRaw = (exportsRes.data ?? []) as Array<Record<string, unknown>>;
  const exportCandidates = filterDeviceExportsByAthleteDataSourcePreference(exportCandidatesRaw, prefMap);

  const deviceExportRows = filterDeviceExportsForPanelDate(exportCandidates, dateKey);
  const timeSeriesSamplesRows = (timeSeriesRes.data ?? []) as Array<Record<string, unknown>>;
  const nutritionPlan = await loadNutritionPlanDayContext(db, athleteId, dateKey, planned);

  return {
    slice: {
      athleteId,
      date: dateKey,
      planned,
      executed,
      diaryRows,
      biomarkerRows,
      deviceExportRows,
      timeSeriesSamplesRows: timeSeriesSamplesRows.length ? timeSeriesSamplesRows : undefined,
      nutritionPlan,
    },
    queryError: null,
  };
}
