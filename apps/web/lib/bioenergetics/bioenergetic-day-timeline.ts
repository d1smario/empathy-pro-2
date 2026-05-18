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

/**
 * Ora pasto per timeline / OpenAI: parsing `entry_time` (HH:MM o ISO) oppure fallback da `meal_slot`
 * + scarto per indice (evita che tutti i pasti senza orario finiscano alle 12:00 → nessun picco post-prandiale plausibile).
 */
export function resolveMealTimelineIsoTs(date: string, row: Record<string, unknown>, mealIndex: number): string {
  const raw = typeof row.entry_time === "string" ? row.entry_time.trim() : "";
  let hhmmss: string | null = null;
  if (raw) {
    if (raw.includes("T")) {
      const afterT = raw.split("T")[1] ?? "";
      const m = /^(\d{2}:\d{2}(?::\d{2})?)/.exec(afterT);
      if (m) hhmmss = m[1]!.length === 5 ? `${m[1]}:00` : m[1]!;
    } else if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(raw)) {
      const parts = raw.split(":");
      const h = Math.min(23, Math.max(0, Number(parts[0])));
      const mi = Math.min(59, Math.max(0, Number(parts[1])));
      const s = parts[2] != null ? Math.min(59, Math.max(0, Number(parts[2]))) : 0;
      hhmmss = `${pad2(h)}:${pad2(mi)}:${pad2(s)}`;
    }
  }
  if (hhmmss) return `${date}T${hhmmss}`;

  const slot = String(row.meal_slot ?? "other").toLowerCase();
  const baseMinute: Record<string, number> = {
    breakfast: 8 * 60 + 15,
    lunch: 13 * 60,
    dinner: 20 * 60,
    snack: 16 * 60,
    other: 12 * 60,
  };
  let mod = (baseMinute[slot] ?? baseMinute.other) + (mealIndex % 36) * 8;
  mod = Math.max(7 * 60 + 30, Math.min(22 * 60 + 45, mod));
  const h = Math.floor(mod / 60);
  const m = mod % 60;
  return `${date}T${pad2(h)}:${pad2(m)}:00`;
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

function workoutStartIsoFromTrace(row: ExecutedWorkout): string | null {
  const tr = row.traceSummary;
  if (!tr || typeof tr !== "object") return null;
  const w = (tr as Record<string, unknown>).workout_start_iso;
  return typeof w === "string" && w.includes("T") ? w.trim() : null;
}

function executedSessionIsoTs(row: ExecutedWorkout, index: number): string {
  const started = row.startedAt?.trim();
  if (started && started.length >= 13 && started.includes("T")) return started;
  const fromTrace = workoutStartIsoFromTrace(row);
  if (fromTrace) return fromTrace;
  const d = toDateKey(row.date);
  return staggerSessionTs(d, index, 2);
}

/**
 * Timeline canonica giornata bioenergetica (stessa usata da assembler e da route confronto sim).
 */
export function buildBioenergeticDayTimeline(date: string, slice: BioenergeticDayMemorySlice): BioenergeticTimelineEvent[] {
  const timeline: BioenergeticTimelineEvent[] = [];

  for (const row of slice.nutritionPlan.plannedMeals) {
    timeline.push({
      id: `plan-meal-${row.slot}`,
      ts: row.entry_time,
      type: "meal",
      title: row.food_label,
      payload: {
        mealSlot: row.slot,
        carbsG: row.carbs_g,
        kcal: row.kcal,
        plannedMeal: true,
        planSource: slice.nutritionPlan.planSource,
      },
    });
  }

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
  slice.diaryRows.forEach((row, mealIndex) => {
    const giEst = num(row.glycemic_index_estimate);
    timeline.push({
      id: `meal-${String(row.id)}`,
      ts: resolveMealTimelineIsoTs(date, row, mealIndex),
      type: "meal",
      title: String(row.food_label ?? "Meal"),
      payload: {
        mealSlot: row.meal_slot,
        plannedMeal: false,
        carbsG: num(row.carbs_g),
        proteinG: num(row.protein_g),
        fatG: num(row.fat_g),
        kcal: num(row.kcal),
        insulinLoad: num(row.insulin_load),
        glycemicLoad: num(row.glycemic_load),
        ...(giEst != null && giEst > 0 && giEst <= 100 ? { glycemicIndex: Math.round(giEst) } : {}),
      },
    });
  });

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
