import type { ExecutedWorkout, PlannedWorkout } from "@empathy/contracts";
import type { BioenergeticTimelineEvent } from "@/api/bioenergetics/contracts";
import type { BioenergeticDayMemorySlice } from "@/lib/bioenergetics/bioenergetic-day-memory-slice";
import { num } from "@/lib/bioenergetics/bioenergetic-day-payload-parsers";

function toDateKey(value: string): string {
  return value.slice(0, 10);
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function staggerSessionTs(date: string, index: number, phaseQuarterHours: number): string {
  const startMin = 7 * 60 + phaseQuarterHours * 15 + index * 75;
  const capped = Math.min(Math.max(startMin, 6 * 60), 21 * 60 + 45);
  const h = Math.floor(capped / 60);
  const m = capped % 60;
  return `${date}T${pad2(h)}:${pad2(m)}:00`;
}

const PLANNED_SESSION_SLOTS_ISO = ["07:15:00", "12:15:00", "17:30:00", "19:15:00"] as const;

function plannedSessionIsoTs(row: PlannedWorkout, index: number): string {
  const d = toDateKey(row.date);
  const t = PLANNED_SESSION_SLOTS_ISO[index % PLANNED_SESSION_SLOTS_ISO.length];
  return `${d}T${t}`;
}

function executedSessionIsoTs(row: ExecutedWorkout, index: number): string {
  const started = row.startedAt?.trim();
  if (started && started.length >= 13 && started.includes("T")) return started;
  const d = toDateKey(row.date);
  return staggerSessionTs(d, index, 2);
}

/**
 * Timeline canonica giornata bioenergetica (stessa usata da assembler e da route confronto sim).
 */
export function buildBioenergeticDayTimeline(date: string, slice: BioenergeticDayMemorySlice): BioenergeticTimelineEvent[] {
  const timeline: BioenergeticTimelineEvent[] = [];

  slice.planned.forEach((row, i) => {
    timeline.push({
      id: `plan-${row.id}`,
      ts: plannedSessionIsoTs(row, i),
      type: "planned_session",
      title: row.type ?? "Sessione pianificata",
      payload: { durationMinutes: row.durationMinutes, tssTarget: row.tssTarget, kcalTarget: row.kcalTarget },
    });
  });
  slice.executed.forEach((row, i) => {
    timeline.push({
      id: `exec-${row.id}`,
      ts: executedSessionIsoTs(row, i),
      type: "executed_session",
      title: "Sessione eseguita",
      payload: { durationMinutes: row.durationMinutes, tss: row.tss, kcal: row.kcal, source: row.source },
    });
  });
  for (const row of slice.diaryRows) {
    const t = typeof row.entry_time === "string" && row.entry_time.trim() ? row.entry_time.slice(0, 8) : "12:00:00";
    const giEst = num(row.glycemic_index_estimate);
    timeline.push({
      id: `meal-${String(row.id)}`,
      ts: `${date}T${t}`,
      type: "meal",
      title: String(row.food_label ?? "Meal"),
      payload: {
        mealSlot: row.meal_slot,
        carbsG: num(row.carbs_g),
        proteinG: num(row.protein_g),
        fatG: num(row.fat_g),
        kcal: num(row.kcal),
        insulinLoad: num(row.insulin_load),
        glycemicLoad: num(row.glycemic_load),
        ...(giEst != null && giEst > 0 && giEst <= 100 ? { glycemicIndex: Math.round(giEst) } : {}),
      },
    });
  }

  for (const row of slice.deviceExportRows) {
    const createdAt = typeof row.created_at === "string" ? row.created_at : null;
    const provider = typeof row.provider === "string" ? row.provider : "device";
    timeline.push({
      id: `dev-${String(row.id ?? createdAt ?? provider)}`,
      ts: createdAt ?? `${date}T12:00:00`,
      type: "device_export",
      title: `Export ${provider}`,
    });
  }

  for (const row of slice.biomarkerRows) {
    const dateTs =
      typeof row.sample_date === "string" && row.sample_date.trim()
        ? `${row.sample_date}T07:00:00`
        : typeof row.created_at === "string"
          ? row.created_at
          : `${date}T07:00:00`;
    timeline.push({
      id: `lab-${String(row.id ?? dateTs)}`,
      ts: dateTs,
      type: "lab_marker",
      title: "Panel biomarker",
    });
  }

  timeline.sort((a, b) => a.ts.localeCompare(b.ts));
  return timeline;
}
