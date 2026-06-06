/**
 * Layer intelligence condiviso post-compose (V1 + V2).
 * Pathway advice, integrazione giornaliera, rescale kcal, boostNote.
 */

import type {
  IntelligentMealPlanAssembledCore,
  IntelligentMealPlanItemOut,
  IntelligentMealPlanRequest,
  IntelligentMealPlanRequestSlot,
  IntelligentMealPlanSlotOut,
  MealSlotKey,
} from "@/lib/nutrition/intelligent-meal-plan-types";
import { rescaleSlotKcalToTarget } from "@/lib/nutrition/intelligent-meal-plan-types";
import { inferCanonicalFoodKeyPreferName, nutrientsForMealPlanItem } from "@/lib/nutrition/canonical-food-composition";
import type { MediterraneanComposedMeal, MediterraneanDayContext, MediterraneanDietType } from "@/lib/nutrition/mediterranean-meal-composer";
import { createMediterraneanDayContext } from "@/lib/nutrition/mediterranean-meal-composer";
import { applyPathwayAdvice } from "@/lib/nutrition/meal-pathway-advisor";
import { registerMealCanonicalKeys } from "@/lib/nutrition/meal-rotation-guard";
import { buildDailySupplementIntegrationPlan } from "@/lib/nutrition/meal-plan-daily-supplement-scheduler";
import { buildMealPlanFoodDenyFragments } from "@/lib/nutrition/meal-plan-profile-food-filter";
import { nutrientBoostAppliesToSlot } from "@/lib/nutrition/pathway-absorption-hints";
import type { NutrientTargetId } from "@/lib/nutrition/pathway-cofactors-to-nutrient-targets";
import { isRacePreRaceMealSlot, racePreLunchContextLine } from "@/lib/nutrition/race-day-pre-race-lunch";

const VALID_NUTRIENT_TARGET_IDS = new Set<NutrientTargetId>([
  "vitA_mcg_RAE",
  "vitC_mg",
  "vitD_mcg",
  "vitE_mg",
  "vitK_mcg",
  "thiamineB1_mg",
  "riboflavinB2_mg",
  "niacinB3_mg",
  "vitB6_mg",
  "folate_mcg",
  "vitB12_mcg",
  "ca_mg",
  "fe_mg",
  "mg_mg",
  "p_mg",
  "k_mg",
  "na_mg",
  "zn_mg",
  "se_mcg",
  "fiberG",
  "omega3G",
]);

function normalizeDietType(raw: string | null | undefined): MediterraneanDietType {
  const d = (raw ?? "").trim().toLowerCase();
  if (d === "vegan" || d.includes("vegan")) return "vegan";
  if (d === "vegetarian" || d.includes("veget")) return "vegetarian";
  if (d === "pescatarian" || d.includes("pesc")) return "pescatarian";
  return "omnivore";
}

function selectValidBoostTargets(
  targets: NonNullable<IntelligentMealPlanRequest["nutrientBoostTargets"]>,
): Array<{ nutrientId: NutrientTargetId; labelIt: string }> {
  return targets
    .filter((t) => VALID_NUTRIENT_TARGET_IDS.has(t.nutrientId as NutrientTargetId))
    .map((t) => ({ nutrientId: t.nutrientId as NutrientTargetId, labelIt: t.labelIt }));
}

function syncItemsApproxKcalFromCanonical(items: IntelligentMealPlanItemOut[]): IntelligentMealPlanItemOut[] {
  return items.map((it) => {
    const { nutrients } = nutrientsForMealPlanItem({
      name: it.name,
      portionHint: it.portionHint,
      approxKcal: it.approxKcal,
    });
    return { ...it, approxKcal: Math.max(8, Math.round(nutrients.kcal)) };
  });
}

export type EnrichMealSlotsInput = {
  request: IntelligentMealPlanRequest;
  slots: IntelligentMealPlanSlotOut[];
  getBaseMealForSlot: (slot: IntelligentMealPlanRequestSlot) => MediterraneanComposedMeal;
  dayCtx?: MediterraneanDayContext;
};

export function buildMediterraneanDayContextFromRequest(req: IntelligentMealPlanRequest): MediterraneanDayContext {
  return createMediterraneanDayContext(
    req.planDate,
    req.weeklyStapleCounts,
    req.postWorkoutMealBySlot,
    normalizeDietType(req.dietType),
    buildMealPlanFoodDenyFragments(req),
    req.suppressedSlots,
    req.racePreLunch ?? undefined,
    req.racePostRecovery ?? undefined,
  );
}

export function enrichMealSlotsAfterCompose(input: EnrichMealSlotsInput): IntelligentMealPlanAssembledCore["slots"] {
  const { request } = input;
  const dayCtx = input.dayCtx ?? buildMediterraneanDayContextFromRequest(request);
  const suppressed = request.suppressedSlots ?? [];
  const validBoostTargets = request.nutrientBoostTargets ? selectValidBoostTargets(request.nutrientBoostTargets) : [];

  const dailyIntegrationPlan = buildDailySupplementIntegrationPlan({
    boostTargets: validBoostTargets,
    slots: request.slots,
    suppressedSlots: suppressed,
    pathwayModulation: request.pathwayModulation,
    dietType: normalizeDietType(request.dietType),
  });

  const slotMeta = new Map(input.slots.map((s) => [s.slot, s]));

  return request.slots.map((slotReq) => {
    const existing = slotMeta.get(slotReq.slot);
    const isSuppressed = suppressed.includes(slotReq.slot);
    const isRacePreLunch = isRacePreRaceMealSlot(slotReq.slot, request.racePreLunch ?? null);

    if (isSuppressed) {
      return (
        existing ?? {
          slot: slotReq.slot,
          targetKcalEcho: slotReq.targetKcal,
          items: [],
          slotCoherence: "",
          slotTimingRationale: "",
        }
      );
    }

    const baseMeal = input.getBaseMealForSlot(slotReq);
    const slotBoostIds = validBoostTargets
      .filter((t) => nutrientBoostAppliesToSlot(t.nutrientId, slotReq.slot, request.pathwayModulation))
      .map((t) => t.nutrientId);

    const pathway = isRacePreLunch
      ? { meal: baseMeal, adviceNotes: [] as string[] }
      : applyPathwayAdvice(baseMeal, slotReq.slot, slotBoostIds, dayCtx);

    registerMealCanonicalKeys(dayCtx, pathway.meal);

    const integrationItems = isRacePreLunch ? [] : dailyIntegrationPlan[slotReq.slot] ?? [];
    const groupTitles = slotReq.functionalFoodGroups.map((g) => g.displayNameIt).join(" · ");
    const bridgePrefix = groupTitles
      ? `Target funzionali (solver): ${groupTitles.slice(0, 180)}${groupTitles.length > 180 ? "…" : ""}. `
      : "";

    let items = syncItemsApproxKcalFromCanonical(
      [...pathway.meal.items, ...integrationItems].map((it) => ({
        ...it,
        functionalBridge: `${bridgePrefix}Composizione mediterranea: ${it.functionalBridge}`.slice(0, 500),
      })),
    );

    if (slotReq.targetKcal > 0) {
      items = rescaleSlotKcalToTarget(
        {
          slot: slotReq.slot,
          targetKcalEcho: slotReq.targetKcal,
          items,
          slotCoherence: "",
          slotTimingRationale: "",
        },
        slotReq.targetKcal,
      ).items;
    }

    const timing =
      slotReq.functionalFoodGroups.find((g) => g.timingHalfLifeHint.trim())?.timingHalfLifeHint ??
      request.pathwayTimingLines[0] ??
      `Orario pasto ${slotReq.scheduledTimeLocal || "—"}; allinea al carico del giorno.`;

    const baseCoherence = isRacePreLunch
      ? racePreLunchContextLine(request.racePreLunch!)
      : groupTitles
        ? `Combinazione solver + funzionale: target ${slotReq.targetKcal} kcal con priorità a ${groupTitles.slice(0, 260)}`
        : `Pasto strutturato su target Diet: ${slotReq.targetKcal} kcal; porzioni da staple sportivi.`;

    const slotBoostNote =
      pathway.adviceNotes.length > 0
        ? `Suggerimenti pathway: ${pathway.adviceNotes.slice(0, 3).join(" | ")}`
        : undefined;

    return {
      slot: slotReq.slot,
      targetKcalEcho: slotReq.targetKcal,
      items,
      slotCoherence: `${baseCoherence}${slotBoostNote ? ` · ${slotBoostNote}` : ""}`.slice(0, 480),
      slotTimingRationale: timing.slice(0, 400),
      boostNote: slotBoostNote,
    };
  });
}

export function pathwayBoostStatusFromRequest(
  request: IntelligentMealPlanRequest,
): IntelligentMealPlanAssembledCore["pathwayBoostStatus"] {
  const valid = request.nutrientBoostTargets ? selectValidBoostTargets(request.nutrientBoostTargets) : [];
  return valid.length > 0 ? "applied" : undefined;
}

export function dayInteractionSummaryExtras(
  request: IntelligentMealPlanRequest,
  engineNote?: string,
): string {
  const validBoostTargets = request.nutrientBoostTargets ? selectValidBoostTargets(request.nutrientBoostTargets) : [];
  const bits = [
    engineNote,
    `Σ pasti solver: ${request.mealPlanSolverMeta.dailyMealsKcalTotal} kcal/giorno`,
    validBoostTargets.length > 0 ? `Cofactors attivi: ${validBoostTargets.map((t) => t.labelIt).join(", ")}` : null,
    request.routineDigest,
  ].filter((s): s is string => Boolean(s?.trim()));
  return bits.join(" · ").slice(0, 820);
}

export type { MealSlotKey };
