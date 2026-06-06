import type { SupabaseClient } from "@supabase/supabase-js";
import {
  enrichIntelligentMealPlanRequestWithRaceDay,
  plannedSessionsForRaceFromDbRows,
} from "@/lib/nutrition/enrich-meal-plan-request-race-day";
import { filterIntelligentMealPlanRequestFoods } from "@/lib/nutrition/meal-plan-profile-food-filter";
import { applyMealSlotRulesToIntelligentMealPlanRequest } from "@/lib/nutrition/meal-slot-food-rules";
import { reconcileMealPlanSlotsWithDiet } from "@/lib/nutrition/reconcile-meal-plan-slots-with-diet";
import type { IntelligentMealPlanRequest, IntelligentMealPlanRequestSlot } from "@/lib/nutrition/intelligent-meal-plan-types";
import { resolveNutritionDietDay } from "@/lib/nutrition/resolve-nutrition-diet-day";
import { parsePro2BuilderSessionFromNotes } from "@/lib/training/builder/pro2-session-notes";
import { resolvePlannedSessionMetrics } from "@/lib/training/physiology/planned-session-metrics";
import { extractPlannedSessionsFromRequest } from "@/lib/nutrition/v2/daily-nutrition-requirements";

function isRecord(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === "object" && !Array.isArray(v);
}

function sanitizeWeeklyStapleCounts(raw: unknown): Record<string, number> | undefined {
  if (!isRecord(raw)) return undefined;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof k !== "string" || k.length > 72) continue;
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 21) continue;
    out[k] = Math.min(21, Math.floor(v));
  }
  return Object.keys(out).length ? out : undefined;
}

export type PreparedIntelligentMealPlanContext = {
  request: IntelligentMealPlanRequest;
  athleteId: string;
  planDate: string;
  profileRow: Record<string, unknown> | null;
  dietDay: ReturnType<typeof resolveNutritionDietDay>;
  plannedSessions: Array<{ label: string; avgPowerW: number; durationMin: number }>;
  ftp: number;
  weightKg: number;
  performanceIntegration?: import("@/lib/nutrition/performance-integration-scaler").NutritionPerformanceIntegrationDials | null;
};

export async function prepareIntelligentMealPlanContext(
  db: SupabaseClient,
  body: Record<string, unknown>,
): Promise<PreparedIntelligentMealPlanContext | { error: string; status: number }> {
  const athleteId = String(body.athleteId ?? "").trim();
  if (!athleteId) return { error: "Missing athleteId", status: 400 };

  const planDate =
    String((body.plan as Record<string, unknown> | undefined)?.planDate ?? "")
      .slice(0, 10) || new Date().toISOString().slice(0, 10);

  const [{ data: profileRow }, { data: plannedRows }] = await Promise.all([
    db
      .from("athlete_profiles")
      .select(
        "nutrition_config, routine_config, preferred_meal_count, weight_kg, diet_type, lifestyle_activity_class, ftp_watts, supplement_config",
      )
      .eq("id", athleteId)
      .maybeSingle(),
    db
      .from("planned_workouts")
      .select("duration_minutes, type, notes, tss_target, kcal_target")
      .eq("athlete_id", athleteId)
      .eq("date", planDate),
  ]);

  const plan = body.plan as unknown;
  if (!isRecord(plan)) return { error: "Missing plan", status: 400 };

  const weekly = sanitizeWeeklyStapleCounts(plan.weeklyStapleCounts);
  const planMerged: IntelligentMealPlanRequest = {
    ...(plan as IntelligentMealPlanRequest),
    ...(weekly ? { weeklyStapleCounts: weekly } : {}),
  };

  const clientSlots = Array.isArray(planMerged.slots) ? planMerged.slots : [];
  const dailyMealsKcalTotal =
    typeof planMerged.mealPlanSolverMeta?.dailyMealsKcalTotal === "number"
      ? planMerged.mealPlanSolverMeta.dailyMealsKcalTotal
      : clientSlots.reduce((s, sl) => s + (Number.isFinite(sl.targetKcal) ? sl.targetKcal : 0), 0);

  const row = (profileRow ?? null) as Record<string, unknown> | null;

  const reconciled = reconcileMealPlanSlotsWithDiet({
    planDate,
    nutritionConfig: row?.nutrition_config ?? null,
    routineConfig: row?.routine_config ?? null,
    dailyMealsKcalTotal,
    clientSlots: clientSlots as IntelligentMealPlanRequestSlot[],
    preferredMealCount:
      typeof row?.preferred_meal_count === "number"
        ? row.preferred_meal_count
        : typeof row?.preferred_meal_count === "string"
          ? Number(row.preferred_meal_count)
          : null,
  });

  const planFromDiet: IntelligentMealPlanRequest = {
    ...planMerged,
    athleteId,
    planDate,
    slots: reconciled.slots,
    dietType: row?.diet_type != null ? String(row.diet_type) : planMerged.dietType,
    mealPlanSolverMeta: {
      ...planMerged.mealPlanSolverMeta,
      dailyMealsKcalTotal: Math.round(dailyMealsKcalTotal),
      integrationLeverLines: [
        ...(planMerged.mealPlanSolverMeta?.integrationLeverLines ?? []),
        ...(reconciled.rebuiltFromDiet
          ? [`Diet ${reconciled.mealCountMode} pasti (${reconciled.slots.length} slot) da athlete_profiles.`]
          : []),
      ].slice(0, 16),
    },
  };

  const routineConfig =
    row?.routine_config && typeof row.routine_config === "object" && !Array.isArray(row.routine_config)
      ? (row.routine_config as Record<string, unknown>)
      : null;

  const raceSessions = plannedSessionsForRaceFromDbRows(Array.isArray(plannedRows) ? plannedRows : []);
  const withRace = enrichIntelligentMealPlanRequestWithRaceDay({
    request: planFromDiet,
    routineConfig,
    weightKg: row?.weight_kg,
    plannedSessions: raceSessions,
  });

  const request = applyMealSlotRulesToIntelligentMealPlanRequest(filterIntelligentMealPlanRequestFoods(withRace));

  if (request.athleteId !== athleteId) return { error: "athleteId mismatch", status: 400 };
  if (!Array.isArray(request.slots) || request.slots.length < 3 || request.slots.length > 6) {
    return { error: "plan.slots: da 3 a 6 pasti (Profile Diet)", status: 400 };
  }
  if (
    !request.mealPlanSolverMeta ||
    typeof request.mealPlanSolverMeta.dailyMealsKcalTotal !== "number" ||
    !Array.isArray(request.mealPlanSolverMeta.integrationLeverLines)
  ) {
    return { error: "plan.mealPlanSolverMeta obbligatorio", status: 400 };
  }

  const dietDay = resolveNutritionDietDay(row?.nutrition_config ?? null, planDate, {
    preferredMealCount: row?.preferred_meal_count as number | null,
  });

  const ftp = Number(row?.ftp_watts) || 250;
  const weightKg = Number(row?.weight_kg) || 70;

  const plannedSessions = (Array.isArray(plannedRows) ? plannedRows : []).map((pr, idx) => {
    const notes = String((pr as Record<string, unknown>).notes ?? "");
    const bs = parsePro2BuilderSessionFromNotes(notes || null);
    const m = resolvePlannedSessionMetrics({
      contract: bs,
      durationMinutesDb: Number((pr as Record<string, unknown>).duration_minutes) || 0,
      tssTargetDb: Number((pr as Record<string, unknown>).tss_target) || 0,
      kcalTargetDb: Number((pr as Record<string, unknown>).kcal_target) || 0,
      athleteFtpWatts: ftp,
    });
    return {
      label: `${String((pr as Record<string, unknown>).type ?? "session")} #${idx + 1} · ${m.avgPowerW ?? "?"}W · ${m.durationMinutes}min`,
      avgPowerW: m.avgPowerW ?? Math.round(ftp * 0.75),
      durationMin: m.durationMinutes,
    };
  });

  const sessions =
    plannedSessions.length > 0 ? plannedSessions : extractPlannedSessionsFromRequest(request, ftp);

  const perfRaw =
    (body.plan as Record<string, unknown> | undefined)?.performanceIntegration ??
    (request as Record<string, unknown>).performanceIntegration;
  const performanceIntegration =
    perfRaw && typeof perfRaw === "object" && !Array.isArray(perfRaw)
      ? (perfRaw as import("@/lib/nutrition/performance-integration-scaler").NutritionPerformanceIntegrationDials)
      : null;

  return {
    request,
    athleteId,
    planDate,
    profileRow: row,
    dietDay,
    plannedSessions: sessions,
    ftp,
    weightKg,
    performanceIntegration,
  };
}
