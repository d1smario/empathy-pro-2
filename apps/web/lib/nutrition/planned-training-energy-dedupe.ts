import { isViryaPlannedWorkout } from "@/lib/training/virya/virya-planned-notes";

export type PlannedTrainingEnergyRow = {
  durationMinutes?: number | null;
  kcalTarget?: number | null;
  tssTarget?: number | null;
  avgPowerW?: number | null;
  notes?: string | null;
};

const BUILDER_DOMINATES_MARKER = /\[PRO2_BUILDER/i;

/**
 * Se nel giorno c’è almeno una seduta Builder (non solo VIRYA), escludi le righe VIRYA
 * dal solver energetico — fallback se purge DB non è avvenuto.
 */
export function dedupePlannedTrainingForNutritionEnergy<T extends PlannedTrainingEnergyRow>(
  rows: T[],
): T[] {
  if (rows.length <= 1) return rows;
  const hasBuilderDominant = rows.some((r) => {
    const notes = r.notes ?? "";
    if (isViryaPlannedWorkout(notes)) return false;
    return BUILDER_DOMINATES_MARKER.test(notes) || notes.includes("BUILDER_SESSION_JSON");
  });
  if (!hasBuilderDominant) return rows;
  return rows.filter((r) => !isViryaPlannedWorkout(r.notes));
}
