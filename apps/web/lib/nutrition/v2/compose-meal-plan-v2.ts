import type {
  DailyNutritionRequirementsV2,
  MealPlanV2ComposedItem,
  MealPlanV2ComposedSlot,
  MealPlanV2DietSlotBudget,
  MealPlanV2ServingBasis,
} from "@empathy/contracts";
import type { IntelligentMealPlanRequest } from "@/lib/nutrition/intelligent-meal-plan-types";
import type { MealSlotKey } from "@/lib/nutrition/intelligent-meal-plan-types";
import { isMainMealSlot } from "@/lib/nutrition/meal-composition-rules";
import type { MediterraneanDietType } from "@/lib/nutrition/mediterranean-meal-composer";
import {
  createMediterraneanDayContext,
  type MediterraneanDayContext,
} from "@/lib/nutrition/mediterranean-meal-composer";
import {
  composeRacePostRecoveryMeal,
  composeRacePreLunchMainMeal,
  isRacePreRaceMealSlot,
} from "@/lib/nutrition/race-day-pre-race-lunch";
import type { FdcFoodBrowseHit } from "@/lib/nutrition/v2/fdc-branch-query";
import { filterFdcCandidates } from "@/lib/nutrition/v2/fdc-candidate-filter";
import { solveFdcMealPortions, type FdcAssemblyLine } from "@/lib/nutrition/v2/fdc-meal-macro-solver";
import { pickBestFdcForRole, type RolePickContext } from "@/lib/nutrition/v2/fdc-healthy-meal-scoring";
import {
  labelItForStaple,
  pickStapleForPool,
  servingBasisForCanonical,
  type StapleRegistryEntry,
} from "@/lib/nutrition/v2/fdc-staple-registry";
import { mediterraneanMealToV2Items } from "@/lib/nutrition/v2/v2-mediterranean-meal-adapter";
import {
  MEAL_SLOT_ASSEMBLY,
  slotMacroTargetsFromDiet,
  type MealSlotAssemblyRole,
} from "@/lib/nutrition/v2/meal-slot-assembly-spec";

export type FdcPoolMap = Map<string, FdcFoodBrowseHit[]>;

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function macrosFromHit(
  c: FdcFoodBrowseHit,
  grams: number,
): Omit<MealPlanV2ComposedItem, "fdcId" | "description" | "grams" | "canonicalKey" | "servingBasis"> {
  const f = grams / 100;
  return {
    kcal: round1(c.kcalPer100g * f),
    choG: round1(c.carbsPer100g * f),
    proG: round1(c.proteinPer100g * f),
    fatG: round1(c.fatPer100g * f) || round1(((c.kcalPer100g - c.carbsPer100g * 4 - c.proteinPer100g * 4) / 9) * f) || 0,
  };
}

function pickFromPoolFallback(
  pool: FdcFoodBrowseHit[],
  ctx: RolePickContext,
  denyFragments: string[],
  usedFdcIds: Set<number>,
  staplePenalty: (description: string) => number,
): FdcFoodBrowseHit | null {
  const filtered = filterFdcCandidates(pool, denyFragments);
  const pick = pickBestFdcForRole(filtered, ctx, denyFragments, usedFdcIds, staplePenalty);
  if (pick) return pick;

  if (isMainMealSlot(ctx.slot) && ctx.spec.foodRole === "cho_complex") {
    for (const hit of filtered) {
      if (usedFdcIds.has(hit.fdcId) || hit.carbsPer100g < 12) continue;
      if (/\b(pasta|rice|riso|potato|quinoa|spaghetti)\b/i.test(hit.description)) return hit;
    }
  }
  return null;
}

export function portionHintIt(
  label: string,
  grams: number,
  spec: MealSlotAssemblyRole,
  servingBasis?: MealPlanV2ServingBasis,
): string {
  const g = Math.round(grams);
  const basis = servingBasis ?? "dry_grams";
  if (spec.foodRole === "cho_complex" && (/pasta|semola/i.test(label) || basis === "dry_grams" && /pasta/i.test(label))) {
    return `${g} g pasta di semola (peso a crudo)`;
  }
  if (spec.foodRole === "cho_complex" && (/riso/i.test(label) || /rice/i.test(label))) {
    return basis === "dry_grams" ? `${g} g riso (peso a crudo)` : `${g} g riso cotto`;
  }
  if (spec.foodRole === "cho_complex" && /patat/i.test(label)) {
    return `${g} g patate lesse o al forno`;
  }
  if (spec.foodRole === "protein_primary" && /uov/i.test(label)) {
    return `${Math.max(1, Math.round(g / 50))} uova medie (≈${g} g)`;
  }
  if (spec.foodRole === "fat" && /olio/i.test(label)) {
    return `${g} ml olio EVO`;
  }
  if (/latte/i.test(label)) {
    return `${g} ml latte`;
  }
  if (basis === "ml") return `${g} ml ${label}`;
  if (basis === "cooked_grams") return `${g} g ${label} (cotto)`;
  return `${g} g ${label}`;
}

type PickLine = FdcAssemblyLine & { staple?: StapleRegistryEntry };

function pickLineForRole(
  spec: MealSlotAssemblyRole,
  slotKey: MealSlotKey,
  pools: FdcPoolMap,
  ctx: ComposeContext,
): PickLine | null {
  const roleCtx: RolePickContext = { slot: slotKey, poolKey: spec.poolKey, spec };
  const seed = ctx.seed + spec.poolKey.length;

  const staplePick = pickStapleForPool({
    poolKey: spec.poolKey,
    seed,
    dietType: ctx.dietType,
    denyFragments: ctx.denyFragments,
    dayCtx: ctx.dayCtx,
    usedCarbFamilies: ctx.usedCarbFamilies,
    usedFdcIds: ctx.usedFdcIds,
  });

  if (staplePick) {
    if (staplePick.entry.carbFamily) ctx.usedCarbFamilies.add(staplePick.entry.carbFamily);
    if (staplePick.hit.fdcId > 0) ctx.usedFdcIds.add(staplePick.hit.fdcId);
    ctx.dayCtx.dayUsedCanonicalKeys?.add(staplePick.entry.canonicalKey);
    return { spec, hit: staplePick.hit, staple: staplePick.entry };
  }

  const rawPool = pools.get(spec.poolKey) ?? [];
  const hit = pickFromPoolFallback(rawPool, roleCtx, ctx.denyFragments, ctx.usedFdcIds, ctx.staplePenalty);
  if (!hit) return null;
  ctx.usedFdcIds.add(hit.fdcId);
  return { spec, hit };
}

type ComposeContext = {
  seed: number;
  dietType?: MediterraneanDietType;
  denyFragments: string[];
  dayCtx: MediterraneanDayContext;
  usedFdcIds: Set<number>;
  usedCarbFamilies: Set<string>;
  staplePenalty: (description: string) => number;
  request?: IntelligentMealPlanRequest;
};

function composeSlotFromAssembly(slot: MealPlanV2DietSlotBudget, pools: FdcPoolMap, ctx: ComposeContext): MealPlanV2ComposedSlot {
  const slotKey = slot.key as MealSlotKey;
  const roles = MEAL_SLOT_ASSEMBLY[slotKey] ?? MEAL_SLOT_ASSEMBLY.snack_am;
  const target = slotMacroTargetsFromDiet(slot);

  const lines: PickLine[] = [];
  for (const spec of roles) {
    const line = pickLineForRole(spec, slotKey, pools, ctx);
    if (line) lines.push(line);
  }

  if (lines.length === 0) {
    return {
      slot: slot.key,
      labelIt: slot.label,
      targetKcal: slot.kcal,
      items: [],
      totals: { kcal: 0, choG: 0, proG: 0, fatG: 0 },
    };
  }

  applyRegola7Cho(lines, target, slotKey, ctx);

  const grams = solveFdcMealPortions(lines, target);
  const items: MealPlanV2ComposedItem[] = [];

  lines.forEach((line, i) => {
    const g = grams[i] ?? 0;
    const minG = line.spec.lever === "fat" ? 4 : 8;
    if (g < minG) return;
    const canonicalKey = line.staple?.canonicalKey;
    const servingBasis = line.staple?.servingBasis ?? (canonicalKey ? servingBasisForCanonical(canonicalKey) : undefined);
    const label = line.staple?.labelIt ?? line.hit.description;
    items.push({
      fdcId: line.hit.fdcId,
      description: label,
      grams: g,
      canonicalKey,
      servingBasis,
      ...macrosFromHit(line.hit, g),
    });
  });

  const totals = items.reduce(
    (acc, it) => ({
      kcal: round1(acc.kcal + it.kcal),
      choG: round1(acc.choG + it.choG),
      proG: round1(acc.proG + it.proG),
      fatG: round1(acc.fatG + it.fatG),
    }),
    { kcal: 0, choG: 0, proG: 0, fatG: 0 },
  );

  return {
    slot: slot.key,
    labelIt: slot.label,
    targetKcal: slot.kcal,
    items,
    totals,
  };
}

/** Regola 7: CHO >100g → no pane primario; CHO ≥130g → pane secondario fisso. */
function applyRegola7Cho(lines: PickLine[], target: { carbsG: number }, slotKey: MealSlotKey, ctx: ComposeContext): void {
  if (!isMainMealSlot(slotKey)) return;
  const choIdx = lines.findIndex((l) => l.spec.lever === "cho");
  if (choIdx < 0) return;
  const choLine = lines[choIdx]!;
  if (target.carbsG > 100 && choLine.staple?.canonicalKey === "bread_white") {
    const alt = pickStapleForPool({
      poolKey: choLine.spec.poolKey,
      seed: ctx.seed + 17,
      dietType: ctx.dietType,
      denyFragments: ctx.denyFragments,
      dayCtx: ctx.dayCtx,
      usedCarbFamilies: ctx.usedCarbFamilies,
      usedFdcIds: ctx.usedFdcIds,
    });
    if (alt && alt.entry.canonicalKey !== "bread_white") {
      lines[choIdx] = { spec: choLine.spec, hit: alt.hit, staple: alt.entry };
    }
  }
  if (target.carbsG >= 130 && !lines.some((l) => l.staple?.canonicalKey === "bread_white")) {
    const breadHit = pickStapleForPool({
      poolKey: "breakfast_cho",
      seed: ctx.seed + 31,
      dietType: ctx.dietType,
      denyFragments: ctx.denyFragments,
      dayCtx: ctx.dayCtx,
      usedCarbFamilies: ctx.usedCarbFamilies,
      usedFdcIds: ctx.usedFdcIds,
    });
    if (breadHit?.entry.canonicalKey === "bread_white") {
      lines.push({
        spec: {
          foodRole: "cho_simple",
          lever: "fixed",
          poolKey: "breakfast_cho",
          minG: 40,
          maxG: 90,
          stepG: 5,
          fixedG: target.carbsG >= 180 ? 80 : 55,
        },
        hit: breadHit.hit,
        staple: breadHit.entry,
      });
    }
  }
}

function composeRaceSlot(
  slot: MealPlanV2DietSlotBudget,
  ctx: ComposeContext,
): MealPlanV2ComposedSlot | null {
  const slotKey = slot.key as MealSlotKey;
  const req = ctx.request;
  if (!req) return null;

  const slotMacros = {
    kcal: slot.kcal,
    carbsG: slot.carbs,
    proteinG: slot.protein,
    fatG: slot.fat,
  };

  if (isRacePreRaceMealSlot(slotKey, req.racePreLunch ?? null)) {
    const meal = composeRacePreLunchMainMeal(slotKey, slotMacros, ctx.seed, req.racePreLunch!, ctx.dayCtx);
    const items = mediterraneanMealToV2Items(meal);
    const totals = items.reduce(
      (acc, it) => ({
        kcal: round1(acc.kcal + it.kcal),
        choG: round1(acc.choG + it.choG),
        proG: round1(acc.proG + it.proG),
        fatG: round1(acc.fatG + it.fatG),
      }),
      { kcal: 0, choG: 0, proG: 0, fatG: 0 },
    );
    return { slot: slot.key, labelIt: slot.label, targetKcal: slot.kcal, items, totals };
  }

  if (req.racePostRecovery && slotKey === req.racePostRecovery.mealSlot) {
    const meal = composeRacePostRecoveryMeal(slotKey, ctx.seed, req.racePostRecovery, ctx.dayCtx);
    const items = mediterraneanMealToV2Items(meal);
    const totals = items.reduce(
      (acc, it) => ({
        kcal: round1(acc.kcal + it.kcal),
        choG: round1(acc.choG + it.choG),
        proG: round1(acc.proG + it.proG),
        fatG: round1(acc.fatG + it.fatG),
      }),
      { kcal: 0, choG: 0, proG: 0, fatG: 0 },
    );
    return { slot: slot.key, labelIt: slot.label, targetKcal: slot.kcal, items, totals };
  }

  return null;
}

function normalizeDietType(raw: string | null | undefined): MediterraneanDietType {
  const d = (raw ?? "").trim().toLowerCase();
  if (d === "vegan" || d.includes("vegan")) return "vegan";
  if (d === "vegetarian" || d.includes("veget")) return "vegetarian";
  if (d === "pescatarian" || d.includes("pesc")) return "pescatarian";
  return "omnivore";
}

export function composeMealPlanV2(
  requirements: DailyNutritionRequirementsV2,
  dietSlots: MealPlanV2DietSlotBudget[],
  pools: FdcPoolMap,
  options?: {
    denyFragments?: string[];
    weeklyStapleCounts?: Record<string, number>;
    suppressedSlots?: MealSlotKey[];
    request?: IntelligentMealPlanRequest;
  },
): MealPlanV2ComposedSlot[] {
  void requirements;
  const denyFragments = options?.denyFragments ?? [];
  const suppressed = new Set(options?.suppressedSlots ?? []);
  const request = options?.request;
  const seed = Math.abs((request?.planDate ?? "2026-01-01").split("-").reduce((a, p) => a + Number(p), 0));

  const dayCtx = createMediterraneanDayContext(
    request?.planDate ?? new Date().toISOString().slice(0, 10),
    options?.weeklyStapleCounts,
    request?.postWorkoutMealBySlot,
    normalizeDietType(request?.dietType),
    denyFragments,
    options?.suppressedSlots,
    request?.racePreLunch ?? undefined,
    request?.racePostRecovery ?? undefined,
  );

  const usedFdcIds = new Set<number>();
  const usedCarbFamilies = new Set<string>();

  const staplePenalty = (description: string): number => {
    const key = description.slice(0, 40).toLowerCase();
    return options?.weeklyStapleCounts?.[key] ?? 0;
  };

  const ctx: ComposeContext = {
    seed,
    dietType: normalizeDietType(request?.dietType),
    denyFragments,
    dayCtx,
    usedFdcIds,
    usedCarbFamilies,
    staplePenalty,
    request,
  };

  return dietSlots.map((slot) => {
    if (suppressed.has(slot.key as MealSlotKey)) {
      return {
        slot: slot.key,
        labelIt: slot.label,
        targetKcal: slot.kcal,
        items: [],
        totals: { kcal: 0, choG: 0, proG: 0, fatG: 0 },
      };
    }
    const raceSlot = composeRaceSlot(slot, ctx);
    if (raceSlot) return raceSlot;
    return composeSlotFromAssembly(slot, pools, ctx);
  });
}

export { labelItForStaple };
