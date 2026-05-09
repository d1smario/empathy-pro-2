import type { SupabaseClient } from "@supabase/supabase-js";
import type { ExecutedWorkout, PlannedWorkout } from "@empathy/contracts";
import { executedWorkoutFromDbRow, plannedWorkoutFromDbRow, type ExecutedWorkoutDbRow, type PlannedWorkoutDbRow } from "@empathy/domain-training";
import { wellnessExportMatchesPanelDate } from "@/lib/physiology/wellness-day-key-from-device-export";
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
};

function addDaysIsoDate(date: string, deltaDays: number): string {
  const base = new Date(`${date.slice(0, 10)}T12:00:00.000Z`);
  if (Number.isNaN(base.getTime())) return date.slice(0, 10);
  base.setUTCDate(base.getUTCDate() + deltaDays);
  return base.toISOString().slice(0, 10);
}

/** Esporta per test: filtra export il cui giorno logico o `created_at` coincide con il pannello. */
export function filterDeviceExportsForPanelDate(
  candidates: Array<Record<string, unknown>>,
  panelDate: string,
): Array<Record<string, unknown>> {
  return candidates.filter((row) => {
    if (wellnessExportMatchesPanelDate(row, panelDate)) return true;
    const ca = typeof row.created_at === "string" ? row.created_at : "";
    return ca.slice(0, 10) === panelDate;
  });
}

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

  const [windowRes, diaryRes, exportsRes, biomarkersRes] = await Promise.all([
    queryPlannedExecutedWindow(db, athleteId, dateKey, dateKey),
    db
      .from("food_diary_entries")
      .select("id, entry_date, entry_time, meal_slot, food_label, carbs_g, protein_g, fat_g, kcal, insulin_load")
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
      },
      queryError: biomarkersRes.error.message,
    };
  }

  const planned = ((windowRes.planned.data ?? []) as PlannedWorkoutDbRow[]).map(plannedWorkoutFromDbRow);
  const executed = ((windowRes.executed.data ?? []) as ExecutedWorkoutDbRow[]).map(executedWorkoutFromDbRow);
  const diaryRows = (diaryRes.data ?? []) as Array<Record<string, unknown>>;
  const biomarkerRows = (biomarkersRes.data ?? []) as Array<Record<string, unknown>>;
  const exportCandidates = (exportsRes.data ?? []) as Array<Record<string, unknown>>;

  const deviceExportRows = filterDeviceExportsForPanelDate(exportCandidates, dateKey);

  return {
    slice: {
      athleteId,
      date: dateKey,
      planned,
      executed,
      diaryRows,
      biomarkerRows,
      deviceExportRows,
    },
    queryError: null,
  };
}
