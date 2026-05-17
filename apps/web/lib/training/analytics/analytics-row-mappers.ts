import {
  executedWorkoutFromDbRow,
  type ExecutedWorkout,
  type PlannedWorkout,
} from "@empathy/domain-training";
import { workoutDayKey } from "@/lib/training/calendar-analyzer-helpers";

function isRealExecutedId(id: unknown): id is string {
  return typeof id === "string" && id.length > 0 && !id.startsWith("device-") && !id.startsWith("biomarker-");
}

function numField(v: unknown, fallback = 0): number | string {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") return v;
  return fallback;
}

function optNumField(v: unknown): number | string | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") return v;
  return null;
}

export function executedWorkoutsFromAnalyticsRows(
  rows: Array<Record<string, unknown>>,
  athleteId: string,
): ExecutedWorkout[] {
  const out: ExecutedWorkout[] = [];
  for (const row of rows) {
    if (!isRealExecutedId(row.id)) continue;
    const date = typeof row.date === "string" ? row.date : "";
    if (!date) continue;
    out.push(
      executedWorkoutFromDbRow({
        id: row.id,
        athlete_id: athleteId,
        date,
        started_at: typeof row.started_at === "string" ? row.started_at : null,
        ended_at: typeof row.ended_at === "string" ? row.ended_at : null,
        duration_minutes: numField(row.duration_minutes),
        tss: numField(row.tss),
        source: typeof row.source === "string" ? row.source : null,
        kcal: optNumField(row.kcal),
        kj: optNumField(row.kj),
        trace_summary: (row.trace_summary as Record<string, unknown> | null) ?? null,
        lactate_mmoll: optNumField(row.lactate_mmoll),
        glucose_mmol: optNumField(row.glucose_mmol),
        smo2: optNumField(row.smo2),
      }),
    );
  }
  return out;
}

export function plannedWorkoutsFromAnalyticsRows(
  rows: Array<Record<string, unknown>>,
  athleteId: string,
): PlannedWorkout[] {
  const out: PlannedWorkout[] = [];
  for (const row of rows) {
    const id = row.id;
    const date = typeof row.date === "string" ? row.date : "";
    if (!date) continue;
    out.push({
      id: typeof id === "string" ? id : `planned-${date}-${out.length}`,
      athleteId,
      date: date.slice(0, 10) as PlannedWorkout["date"],
      durationMinutes: Number(numField(row.duration_minutes)),
      tssTarget: Number(numField(row.tss_target)),
      type: typeof row.type === "string" ? row.type : "workout",
      notes: typeof row.notes === "string" ? row.notes : undefined,
    });
  }
  return out;
}

export function filterWorkoutsByDate(workouts: ExecutedWorkout[], dateKey: string): ExecutedWorkout[] {
  const d = dateKey.slice(0, 10);
  return workouts.filter((w) => workoutDayKey(w) === d);
}

export function filterPlannedByDate(planned: PlannedWorkout[], dateKey: string): PlannedWorkout[] {
  const d = dateKey.slice(0, 10);
  return planned.filter((w) => w.date.slice(0, 10) === d);
}

export function monthWorkoutsForDate(workouts: ExecutedWorkout[], dateKey: string): ExecutedWorkout[] {
  const ym = dateKey.slice(0, 7);
  return workouts.filter((w) => workoutDayKey(w).slice(0, 7) === ym);
}
