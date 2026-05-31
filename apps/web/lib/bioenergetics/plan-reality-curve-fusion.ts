import type { BioenergeticDayKernelOutput, BioenergeticSeriesPoint, PlanRealityFusionMetaV1 } from "@/api/bioenergetics/contracts";
import type { BioenergeticDayMemorySlice } from "@/lib/bioenergetics/bioenergetic-day-memory-slice";
import type { BioPlannedMealRow, NutritionPlanDayContext } from "@/lib/bioenergetics/nutrition-plan-day-empty";
import { resolveMealTimelineIsoTs } from "@/lib/bioenergetics/bioenergetic-day-timeline";
import { num } from "@/lib/bioenergetics/bioenergetic-day-payload-parsers";
import { buildSimulatedGluLacDiurnalSubHourly, type SimTimelineEventV1 } from "@empathy/domain-bioenergetics";

/** Prima ora in cui la curva segue diario + sedute eseguite (minimo pomeriggio). */
export const PLAN_REALITY_MIN_ADAPT_HOUR = 12;
/** Se non c'è ancora realtà registrata, tutta la giornata resta sul piano. */
export const PLAN_REALITY_FULL_PLAN_SENTINEL = 24;

function hourFromIso(ts: string): number | null {
  const m = /T(\d{2}):/.exec(ts);
  if (!m) return null;
  const h = Number(m[1]);
  return Number.isFinite(h) && h >= 0 && h <= 23 ? h : null;
}

function plannedSessionIsoTs(date: string, index: number): string {
  const slots = ["07:15:00", "12:15:00", "17:30:00", "19:15:00"] as const;
  return `${date}T${slots[index % slots.length]}`;
}

function executedSessionIsoTs(row: BioenergeticDayMemorySlice["executed"][number], index: number): string {
  const started = row.startedAt?.trim();
  if (started && started.includes("T")) return started;
  const d = String(row.date).slice(0, 10);
  const startMin = 7 * 60 + 15 + index * 75;
  const capped = Math.min(Math.max(startMin, 6 * 60), 21 * 60 + 45);
  const h = Math.floor(capped / 60);
  const m = capped % 60;
  return `${d}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
}

/** Timeline predittiva: pasti da piano nutrizione + sedute pianificate (mattino / primo pomeriggio). */
export function buildPlanPredictiveTimeline(
  date: string,
  slice: BioenergeticDayMemorySlice,
  nutritionPlan: NutritionPlanDayContext,
): SimTimelineEventV1[] {
  const tl: SimTimelineEventV1[] = [];
  nutritionPlan.plannedMeals.forEach((row) => {
    tl.push({
      ts: row.entry_time,
      type: "meal",
      payload: {
        mealSlot: row.slot,
        carbsG: row.carbs_g,
        proteinG: row.protein_g,
        fatG: row.fat_g,
        kcal: row.kcal,
        insulinLoad: row.insulin_load,
        glycemicLoad: row.glycemic_load,
        planSource: nutritionPlan.planSource,
        plannedMeal: true,
      },
    });
  });
  slice.planned.forEach((row, i) => {
    tl.push({
      ts: plannedSessionIsoTs(date.slice(0, 10), i),
      type: "planned_session",
      payload: {
        durationMinutes: row.durationMinutes,
        tssTarget: row.tssTarget,
        kcalTarget: row.kcalTarget,
      },
    });
  });
  return tl.sort((a, b) => a.ts.localeCompare(b.ts));
}

/** Timeline adattiva: diario alimentare + sedute eseguite / import. */
export function buildRealityAdaptiveTimeline(date: string, slice: BioenergeticDayMemorySlice): SimTimelineEventV1[] {
  const tl: SimTimelineEventV1[] = [];
  slice.diaryRows.forEach((row, mealIndex) => {
    const giEst = num(row.glycemic_index_estimate);
    tl.push({
      ts: resolveMealTimelineIsoTs(date, row, mealIndex),
      type: "meal",
      payload: {
        mealSlot: row.meal_slot,
        carbsG: num(row.carbs_g),
        proteinG: num(row.protein_g),
        fatG: num(row.fat_g),
        kcal: num(row.kcal),
        insulinLoad: num(row.insulin_load),
        glycemicLoad: num(row.glycemic_load),
        ...(giEst != null && giEst > 0 && giEst <= 100 ? { glycemicIndex: Math.round(giEst) } : {}),
        plannedMeal: false,
      },
    });
  });
  slice.executed.forEach((row, i) => {
    tl.push({
      ts: executedSessionIsoTs(row, i),
      type: "executed_session",
      payload: {
        durationMinutes: row.durationMinutes,
        tss: row.tss,
        kcal: row.kcal,
        source: row.source,
      },
    });
  });
  return tl.sort((a, b) => a.ts.localeCompare(b.ts));
}

/**
 * Ora da cui iniziare l’adattamento a diario + training eseguito.
 * Regola: prima realtà osservata −1h, clamp [12, 20]; senza realtà → 24 (solo piano).
 */
export function resolvePlanRealityAdaptFromHour(date: string, slice: BioenergeticDayMemorySlice): number {
  let earliest: number | null = null;
  for (const row of slice.diaryRows) {
    const ts = resolveMealTimelineIsoTs(date, row, 0);
    const h = hourFromIso(ts);
    if (h != null) earliest = earliest == null ? h : Math.min(earliest, h);
  }
  for (const row of slice.executed) {
    const ts = executedSessionIsoTs(row, 0);
    const h = hourFromIso(ts);
    if (h != null) earliest = earliest == null ? h : Math.min(earliest, h);
  }
  if (earliest == null) return PLAN_REALITY_FULL_PLAN_SENTINEL;
  const adapt = Math.max(PLAN_REALITY_MIN_ADAPT_HOUR, Math.min(20, earliest - 1));
  return adapt;
}

function blend01(hour: number, adaptFromHour: number, transitionHours: number): number {
  if (adaptFromHour >= PLAN_REALITY_FULL_PLAN_SENTINEL) return 0;
  if (hour < adaptFromHour - transitionHours) return 0;
  if (hour >= adaptFromHour + transitionHours) return 1;
  const t = (hour - (adaptFromHour - transitionHours)) / (2 * transitionHours);
  return Math.max(0, Math.min(1, t));
}

function fuseDenseSeries(
  plan: BioenergeticSeriesPoint[],
  reality: BioenergeticSeriesPoint[],
  adaptFromHour: number,
  transitionHours: number,
): BioenergeticSeriesPoint[] {
  const byTs = new Map<string, BioenergeticSeriesPoint>();
  for (const p of plan) byTs.set(p.ts, { ...p, source: `${p.source}|plan` });
  for (const p of reality) {
    const h = hourFromIso(p.ts);
    if (h == null) continue;
    const w = blend01(h, adaptFromHour, transitionHours);
    if (w >= 0.5) byTs.set(p.ts, { ...p, source: `${p.source}|reality` });
  }
  return [...byTs.values()].sort((a, b) => a.ts.localeCompare(b.ts));
}

export type FusedGluLacSim = {
  glucose: BioenergeticSeriesPoint[];
  lactate: BioenergeticSeriesPoint[];
  insulinProxy: BioenergeticSeriesPoint[];
  meta: PlanRealityFusionMetaV1;
};

/**
 * Due simulazioni (piano+training pianificato vs diario+eseguito) fuse per ora:
 * mattino/pre-adattamento = predittivo; pomeriggio-sera = realtà operativa.
 */
export function fusePlanRealityGluLacSim(input: {
  date: string;
  kernel: BioenergeticDayKernelOutput;
  slice: BioenergeticDayMemorySlice;
  nutritionPlan: NutritionPlanDayContext;
  mealResponseScale01: number;
  activityResponseScale01: number;
  stepMinutes?: 5 | 10;
}): FusedGluLacSim | null {
  const { date, kernel, slice, nutritionPlan } = input;
  const scales = {
    mealResponseScale01: input.mealResponseScale01,
    activityResponseScale01: input.activityResponseScale01,
  };
  const step: 5 | 10 = input.stepMinutes === 10 ? 10 : 5;
  const planTl = buildPlanPredictiveTimeline(date, slice, nutritionPlan);
  const realityTl = buildRealityAdaptiveTimeline(date, slice);
  const adaptFromHour = resolvePlanRealityAdaptFromHour(date, slice);
  const transitionHours = 2;

  const simPlan = buildSimulatedGluLacDiurnalSubHourly(date, kernel, planTl, scales, step);
  const simReality = buildSimulatedGluLacDiurnalSubHourly(date, kernel, realityTl, scales, step);

  const planG = simPlan.glucose ?? [];
  const planL = simPlan.lactate ?? [];
  const planI = simPlan.insulinProxy ?? [];
  const realG = simReality.glucose ?? [];
  const realL = simReality.lactate ?? [];
  const realI = simReality.insulinProxy ?? [];

  if (!planG.length && !realG.length) return null;

  const meta: PlanRealityFusionMetaV1 = {
    contractVersion: 1,
    adaptFromHour,
    planSource: nutritionPlan.planSource,
    plannedMealCount: nutritionPlan.plannedMeals.length,
    diaryMealCount: slice.diaryRows.length,
    executedSessionCount: slice.executed.length,
    transitionHours,
  };

  if (adaptFromHour >= PLAN_REALITY_FULL_PLAN_SENTINEL) {
    return {
      glucose: planG,
      lactate: planL,
      insulinProxy: planI,
      meta,
    };
  }

  return {
    glucose: fuseDenseSeries(planG, realG, adaptFromHour, transitionHours),
    lactate: fuseDenseSeries(planL, realL, adaptFromHour, transitionHours),
    insulinProxy: fuseDenseSeries(planI, realI, adaptFromHour, transitionHours),
    meta,
  };
}

/** Espone meta + ore fuse per audit UI. */
export function planRealityFusionSummaryIt(meta: PlanRealityFusionMetaV1): string {
  if (meta.adaptFromHour >= PLAN_REALITY_FULL_PLAN_SENTINEL) {
    return `Striscia predittiva da piano (${meta.planSource}): ${meta.plannedMealCount} pasti pianificati, ${meta.diaryMealCount} voci diario non ancora usate per adattamento.`;
  }
  return `Fusione piano→realtà: ore 0–${meta.adaptFromHour - 1} da meal plan + training pianificato; da ore ${meta.adaptFromHour} (${meta.transitionHours}h di transizione) diario (${meta.diaryMealCount} pasti) e sedute eseguite (${meta.executedSessionCount}).`;
}
