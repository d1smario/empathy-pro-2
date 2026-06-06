import type {
  FunctionalFoodTargetViewModel,
  NutritionPathwayModulationViewModel,
  UsdaRichFoodItemViewModel,
} from "@/api/nutrition/contracts";
import { buildFunctionalFoodOptionGroupsForSlot } from "@/lib/nutrition/functional-food-option-groups";
import type { IntelligentMealPlanRequest, MealSlotKey } from "@/lib/nutrition/intelligent-meal-plan-types";
import { MEAL_SLOT_KEYS } from "@/lib/nutrition/intelligent-meal-plan-types";
import { filterIntelligentMealPlanRequestFoods } from "@/lib/nutrition/meal-plan-profile-food-filter";
import { applyMealSlotRulesToIntelligentMealPlanRequest } from "@/lib/nutrition/meal-slot-food-rules";
import { buildPathwayTimingLinesForMealPlan } from "@/lib/nutrition/meal-plan-pathway-timing-lines";
import { shortFoodLabelFromUsda } from "@/lib/nutrition/usda-food-label";
import type { FlatMealTimes } from "@/lib/nutrition/routine-week-plan-meal-times";
import {
  buildRoutineDigestForMealPlan,
  computePostWorkoutMealFlags,
  computeSnackSlotsSuppressedByTrainingWindow,
} from "@/lib/nutrition/nutrition-meal-times-training-coherence";
import { buildActiveNutrientTargets } from "@/lib/nutrition/pathway-cofactors-to-nutrient-targets";
import {
  buildRacePostRecoveryContext,
  buildRacePreLunchDayContext,
  computeRaceDaySuppressedSlots,
  racePostRecoveryContextLine,
  racePreLunchContextLine,
  rebalanceMealRowsForRacePostRecovery,
  type PlannedSessionForRaceDetection,
} from "@/lib/nutrition/race-day-pre-race-lunch";
import { buildRoutineSyntheticPlannedSessionsForRaceDetection } from "@/lib/nutrition/routine-race-day-context";

export type PathwaySlotBundleInput = {
  pathwayTargets?: FunctionalFoodTargetViewModel[];
  foods?: UsdaRichFoodItemViewModel[];
};

function isMealSlotKey(s: string): s is MealSlotKey {
  return (MEAL_SLOT_KEYS as readonly string[]).includes(s);
}

function routineMealTimesFlat(routine: Record<string, unknown> | null | undefined): FlatMealTimes {
  const rc = routine && typeof routine === "object" && !Array.isArray(routine) ? routine : {};
  const mt = rc.meal_times && typeof rc.meal_times === "object" && !Array.isArray(rc.meal_times) ? (rc.meal_times as Record<string, unknown>) : {};
  return {
    breakfast: String(mt.breakfast ?? "07:30"),
    lunch: String(mt.lunch ?? "13:00"),
    dinner: String(mt.dinner ?? "20:00"),
    snack_am: String(mt.snack_am ?? "10:30"),
    snack_pm: String(mt.snack_pm ?? mt.snacks ?? "16:30"),
  };
}

export function buildIntelligentMealPlanRequest(input: {
  athleteId: string;
  planDate: string;
  profile: {
    diet_type: string | null;
    intolerances: string[] | null;
    allergies: string[] | null;
    food_exclusions: string[] | null;
    food_preferences: string[] | null;
    supplements: string[] | null;
    routine_config: Record<string, unknown> | null;
    weight_kg?: number | null;
  } | null;
  mealRows: Array<{
    key: string;
    label: string;
    kcal: number;
    carbs: number;
    protein: number;
    fat: number;
    timeLocal: string;
  }>;
  mealPathwayBySlot: Partial<Record<string, PathwaySlotBundleInput>>;
  contextLines: string[];
  pathwayModulation: NutritionPathwayModulationViewModel | null;
  trainingDayLines: string[];
  /** Leve integrazione operativa (solver × training), stesse della UI. */
  integrationLeverLines?: string[];
  /** Sedute pianificate del giorno: digest orari + flag post-seduta per il composer. */
  plannedSessionsForDay?: PlannedSessionForRaceDetection[];
}): IntelligentMealPlanRequest {
  const { mealRows, mealPathwayBySlot } = input;
  const dailyMealsKcalTotal = Math.round(mealRows.reduce((s, r) => s + (Number.isFinite(r.kcal) ? r.kcal : 0), 0));
  const pathwayPathways = input.pathwayModulation?.pathways ?? [];
  const pathwayTimingLines = buildPathwayTimingLinesForMealPlan(input.pathwayModulation);
  const plannedForDay = input.plannedSessionsForDay ?? [];
  const plannedResolved =
    plannedForDay.length > 0
      ? plannedForDay
      : buildRoutineSyntheticPlannedSessionsForRaceDetection({
          routineConfig: input.profile?.routine_config ?? null,
          planDate: input.planDate,
        });
  const activeSlotKeys = mealRows.map((r) => r.key).filter((k): k is MealSlotKey => isMealSlotKey(k));
  const racePreLunch = buildRacePreLunchDayContext({
    weightKg: input.profile?.weight_kg,
    planDate: input.planDate,
    routineConfig: input.profile?.routine_config ?? null,
    plannedSessions: plannedResolved,
    activeMealSlots: activeSlotKeys,
  });
  const raceWeight = { weightKg: input.profile?.weight_kg };
  const routineDigest = buildRoutineDigestForMealPlan(input.profile?.routine_config ?? null, input.planDate, {
    plannedSessions: plannedResolved,
    ...raceWeight,
  });
  const mealTimesFlat = routineMealTimesFlat(input.profile?.routine_config ?? null);
  const suppressedSlots = computeSnackSlotsSuppressedByTrainingWindow({
    routineConfig: input.profile?.routine_config ?? null,
    planDate: input.planDate,
    mealTimesFlatFromRoot: mealTimesFlat,
    plannedSessions: plannedResolved,
    ...raceWeight,
  });
  const mealRowsResolved = racePreLunch
    ? mealRows.map((row) =>
        row.key === racePreLunch.mealSlot ? { ...row, timeLocal: racePreLunch.lunchTimeLocal } : row,
      )
    : mealRows;

  const mealTimesBySlot = Object.fromEntries(
    mealRowsResolved.map((r) => [r.key, r.timeLocal] as const),
  ) as Partial<Record<MealSlotKey, string>>;
  const racePostRecovery = buildRacePostRecoveryContext({
    weightKg: input.profile?.weight_kg,
    planDate: input.planDate,
    routineConfig: input.profile?.routine_config ?? null,
    plannedSessions: plannedResolved,
    activeMealSlots: mealRowsResolved.map((r) => r.key).filter((k): k is MealSlotKey => isMealSlotKey(k)),
    mealTimesBySlot,
  });
  const mealRowsFinal = racePostRecovery
    ? rebalanceMealRowsForRacePostRecovery(mealRowsResolved, racePostRecovery)
    : mealRowsResolved;
  const mealTimesFinal = Object.fromEntries(
    mealRowsFinal.map((r) => [r.key, r.timeLocal] as const),
  ) as Partial<Record<MealSlotKey, string>>;
  const raceSuppressed = racePreLunch
    ? computeRaceDaySuppressedSlots({
        ctx: racePreLunch,
        activeSlots: mealRowsFinal.map((r) => r.key).filter((k): k is MealSlotKey => isMealSlotKey(k)),
        mealTimesBySlot: mealTimesFinal,
        postRecoveryMealSlot: racePostRecovery?.mealSlot ?? null,
      })
    : [];

  const postWorkoutMealBySlot = racePostRecovery?.mealSlot
    ? { [racePostRecovery.mealSlot]: true as const }
    : computePostWorkoutMealFlags({
        routineConfig: input.profile?.routine_config ?? null,
        planDate: input.planDate,
        mealTimesFlatFromRoot: mealTimesFlat,
        plannedSessions: plannedResolved,
        activeMealSlots: mealRowsFinal.map((r) => r.key).filter((k): k is MealSlotKey => isMealSlotKey(k)),
        mealTimesBySlot: mealTimesFinal,
        ...raceWeight,
      });

  /**
   * Bridge sistema intelligente (pathway modulation) → generatore: estrae nutrient target dai
   * cofactors + substrates di tutti i pathway attivi. Il generatore vedrà solo `(B12, Folati, Ferro)`
   * non il concetto di "eritropoiesi" — coerente con `empathy_generative_core.mdc`.
   *
   * Ordine stringhe: **prima tutti i cofactors** di tutti i pathway, **poi tutti i substrates** — così
   * i cofactor qualitativi (es. redox: Vit C, Se, Zn) non restano fuori dal limite perché dopo falsi
   * match su lettere "Na/K" nei substrati glicogeno.
   */
  const cofactorStrings: string[] = [];
  for (const pw of pathwayPathways) {
    for (const c of pw.cofactors ?? []) cofactorStrings.push(c);
  }
  for (const pw of pathwayPathways) {
    for (const s of pw.substrates ?? []) cofactorStrings.push(s);
  }
  const catalogNutrientIds = Object.values(mealPathwayBySlot).flatMap((bundle) =>
    (bundle?.pathwayTargets ?? []).map((t) => t.nutrientId).filter(Boolean),
  );
  const nutrientBoostTargets = buildActiveNutrientTargets({
    cofactorStrings,
    catalogNutrientIds,
  }).map((t) => ({
    nutrientId: t.nutrientId,
    labelIt: t.labelIt,
    sourceText: t.sourceText,
  }));

  const pathwayModulationActiveLabels =
    pathwayPathways.length > 0
      ? pathwayPathways.map((p) => p.pathwayLabel.trim()).filter(Boolean).join(" · ").slice(0, 320)
      : null;

  const slotOrder = mealRowsFinal.map((r) => r.key).filter((k): k is MealSlotKey => isMealSlotKey(k));
  const slots = slotOrder.map((slot) => {
    const row = mealRowsFinal.find((r) => r.key === slot);
    const bundle = mealPathwayBySlot[slot];
    const targets = bundle?.pathwayTargets ?? [];
    const foods = bundle?.foods ?? [];
    const candidates = new Set<string>();
    for (const t of targets) {
      for (const ex of t.curatedExamples ?? []) {
        candidates.add(ex.name);
      }
    }
    for (const f of foods.slice(0, 8)) {
      candidates.add(shortFoodLabelFromUsda(f.description, 48));
    }
    for (const t of targets) {
      for (const q of t.searchQueries ?? []) {
        if (q.trim()) candidates.add(q.trim());
      }
    }

    const functionalFoodGroups = buildFunctionalFoodOptionGroupsForSlot({
      pathwayTargets: targets,
      usdaFoods: foods,
      pathwaySupportPathways: pathwayPathways,
      minPerGroup: 3,
      maxPerGroup: 5,
    }).filter((g) => g.options.length > 0);

    return {
      slot,
      labelIt: row?.label ?? slot,
      scheduledTimeLocal: row?.timeLocal ?? "",
      targetKcal: Math.max(50, Math.round(row?.kcal ?? 400)),
      targetCarbsG: Math.max(0, Math.round(row?.carbs ?? 0)),
      targetProteinG: Math.max(0, Math.round(row?.protein ?? 0)),
      targetFatG: Math.max(0, Math.round(row?.fat ?? 0)),
      functionalTargets: targets.map((t: FunctionalFoodTargetViewModel) => ({
        nutrientId: t.nutrientId,
        displayNameIt: t.displayNameIt,
        pathwayLabel: t.pathwayLabel,
        rationaleShort: t.rationaleIt.length > 220 ? `${t.rationaleIt.slice(0, 217)}…` : t.rationaleIt,
      })),
      functionalFoodGroups,
      foodCandidates: Array.from(candidates).slice(0, 24),
    };
  });

  return applyMealSlotRulesToIntelligentMealPlanRequest(
    filterIntelligentMealPlanRequestFoods({
      athleteId: input.athleteId,
      planDate: input.planDate,
      postWorkoutMealBySlot: Object.keys(postWorkoutMealBySlot).length ? postWorkoutMealBySlot : undefined,
      suppressedSlots:
        suppressedSlots.length > 0 || raceSuppressed.length > 0
          ? [...new Set([...suppressedSlots, ...raceSuppressed])]
          : undefined,
      nutrientBoostTargets: nutrientBoostTargets.length > 0 ? nutrientBoostTargets : undefined,
      pathwayModulationActiveLabels: pathwayModulationActiveLabels ?? undefined,
      pathwayModulation: input.pathwayModulation ?? undefined,
      mealPlanSolverMeta: {
        dailyMealsKcalTotal,
        integrationLeverLines: (input.integrationLeverLines ?? []).slice(0, 16),
      },
      dietType: input.profile?.diet_type ?? null,
      intolerances: input.profile?.intolerances ?? null,
      allergies: input.profile?.allergies ?? null,
      foodExclusions: input.profile?.food_exclusions ?? null,
      foodPreferences: input.profile?.food_preferences ?? null,
      supplements: input.profile?.supplements ?? null,
      aggregateInhibitors: input.pathwayModulation?.aggregateInhibitors ?? null,
      pathwayTimingLines,
      trainingDayLines: input.trainingDayLines.slice(0, 12),
      routineDigest,
      contextLines: [
        ...input.contextLines.slice(0, 18),
        ...(racePreLunch ? [racePreLunchContextLine(racePreLunch)] : []),
        ...(racePostRecovery ? [racePostRecoveryContextLine(racePostRecovery)] : []),
      ],
      slots,
      racePreLunch: racePreLunch ?? undefined,
      racePostRecovery: racePostRecovery ?? undefined,
    }),
  );
}
