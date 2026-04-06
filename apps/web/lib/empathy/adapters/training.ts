import type { PlannedWorkout } from "@/lib/empathy/schemas";

export type PlannedWorkoutDbRow = {
  id: string;
  athlete_id?: string | null;
  date: string;
  type: string | null;
  duration_minutes: number | null;
  tss_target: number | null;
  kj_target?: number | null;
  kcal_target: number | null;
  zone_split?: Record<string, number> | null;
  adaptive_goal?: string | null;
  notes: string | null;
};

export function toCanonicalPlannedWorkout(row: PlannedWorkoutDbRow): PlannedWorkout {
  return {
    id: String(row.id ?? ""),
    athleteId: String(row.athlete_id ?? ""),
    date: String(row.date ?? ""),
    type: String(row.type ?? "session"),
    durationMinutes: Math.max(0, Number(row.duration_minutes) || 0),
    tssTarget: Math.max(0, Number(row.tss_target) || 0),
    kjTarget: Number.isFinite(Number(row.kj_target)) ? Number(row.kj_target) : undefined,
    kcalTarget: Number.isFinite(Number(row.kcal_target)) ? Number(row.kcal_target) : undefined,
    zoneSplit: row.zone_split ?? undefined,
    adaptiveGoal: String(row.adaptive_goal ?? "").trim() || undefined,
    notes: String(row.notes ?? "").trim() || undefined,
  };
}
