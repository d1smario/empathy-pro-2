import type {
  IntelligentMealPlanAssembledCore,
  IntelligentMealPlanItemOut,
  IntelligentMealPlanRequest,
  IntelligentMealPlanRequestSlot,
  IntelligentMealPlanSlotOut,
  MealSlotKey,
} from "@/lib/nutrition/intelligent-meal-plan-types";
import {
  dayInteractionSummaryExtras,
  enrichMealSlotsAfterCompose,
  pathwayBoostStatusFromRequest,
} from "@/lib/nutrition/enrich-meal-slots-after-compose";
import { finalizeIntelligentMealPlanCore } from "@/lib/nutrition/meal-plan-response-finalize";
import { fdcIdForCanonicalKey } from "@/lib/nutrition/canonical-food-fdc-aliases";
import { buildFdcCanonicalSnapshotFromFdcIds, buildFdcCanonicalSnapshotFromFoods } from "@/lib/nutrition/fdc-to-canonical-scaler";
import { loadFdcFoodsByIds } from "@/lib/nutrition/fdc-food-cache";
import type { MealPlanV2Production } from "@/lib/nutrition/v2/build-meal-plan-v2-production";
import { portionHintIt } from "@/lib/nutrition/v2/compose-meal-plan-v2";
import { MEAL_SLOT_ASSEMBLY } from "@/lib/nutrition/v2/meal-slot-assembly-spec";
import { v2ComposedSlotToMediterraneanMeal } from "@/lib/nutrition/v2/v2-mediterranean-meal-adapter";

function macroRoleFromItem(choG: number, proG: number, fatG: number): IntelligentMealPlanItemOut["macroRole"] {
  const choK = choG * 4;
  const proK = proG * 4;
  const fatK = fatG * 9;
  const total = choK + proK + fatK;
  if (total <= 0) return "mixed";
  if (choK / total >= 0.55) return "cho_heavy";
  if (proK / total >= 0.35) return "protein";
  if (fatK / total >= 0.45) return "fat";
  return "mixed";
}

function mapItem(
  item: MealPlanV2Production["composedMealPlan"][number]["items"][number],
  slotKey: MealSlotKey,
  itemIndex: number,
): IntelligentMealPlanItemOut {
  const label = item.description;
  const roles = MEAL_SLOT_ASSEMBLY[slotKey] ?? [];
  const spec = roles[itemIndex] ?? roles[roles.length - 1] ?? {
    foodRole: "cho_simple" as const,
    lever: "cho" as const,
    poolKey: "snack_cho",
    minG: 25,
    maxG: 180,
    stepG: 5,
  };
  const canonicalKey = item.canonicalKey;
  const compositionKey =
    item.fdcId > 0 && item.servingBasis
      ? `fdc:${item.fdcId}`
      : canonicalKey && fdcIdForCanonicalKey(canonicalKey)
        ? `fdc:${fdcIdForCanonicalKey(canonicalKey)}`
        : canonicalKey ?? `fdc:${item.fdcId}`;

  return {
    name: label,
    portionHint: portionHintIt(label, item.grams, spec, item.servingBasis),
    functionalBridge: "Alimentazione sportiva · staple canonico",
    approxKcal: Math.round(item.kcal),
    macroRole: macroRoleFromItem(item.choG, item.proG, item.fatG),
    compositionKey,
    compositionStatus: compositionKey.startsWith("fdc:") ? "fdc_cache" : "canonical_estimate",
  };
}

function slotCoherenceFor(slot: MealSlotKey, suppressed: boolean): string {
  if (suppressed) {
    return "Pasto soppresso: energia in finestra allenamento → modulo Fueling (substrati V2).";
  }
  return "Composizione mediterranea sportiva: primo + secondo + contorno (V2 staple).";
}

function composedMealForSlot(
  production: MealPlanV2Production,
  slotReq: IntelligentMealPlanRequestSlot,
): ReturnType<typeof v2ComposedSlotToMediterraneanMeal> {
  const composed = production.composedMealPlan.find((s) => s.slot === slotReq.slot);
  if (!composed || composed.items.length === 0) {
    return { items: [], lines: [], totalApproxKcal: 0 };
  }
  const items = composed.items.map((it, idx) => mapItem(it, slotReq.slot as MealSlotKey, idx));
  return {
    items: items.map((it) => ({
      name: it.name,
      portionHint: it.portionHint,
      functionalBridge: it.functionalBridge ?? "",
      approxKcal: it.approxKcal,
      macroRole: it.macroRole,
    })),
    lines: items.map((i) => i.portionHint),
    totalApproxKcal: items.reduce((s, i) => s + i.approxKcal, 0),
  };
}

export function mapV2PlanToV1AssembledCore(
  production: MealPlanV2Production,
  request: IntelligentMealPlanRequest,
): IntelligentMealPlanAssembledCore {
  const suppressed = new Set(request.suppressedSlots ?? []);
  const slotMeta = new Map(request.slots.map((s) => [s.slot, s]));

  const preEnrichSlots: IntelligentMealPlanSlotOut[] = production.composedMealPlan.map((composed) => {
    const slotKey = composed.slot as MealSlotKey;
    const meta = slotMeta.get(slotKey);
    const isSuppressed = suppressed.has(slotKey);

    if (isSuppressed) {
      return {
        slot: slotKey,
        targetKcalEcho: composed.targetKcal,
        items: [
          {
            name: "Fueling in seduta",
            portionHint: "Vedi timeline Fueling",
            functionalBridge: "CHO intra da substrati fisiologici",
            approxKcal: 0,
            macroRole: "cho_heavy",
          },
        ],
        slotCoherence: slotCoherenceFor(slotKey, true),
        slotTimingRationale: meta?.scheduledTimeLocal
          ? `Orario ${meta.scheduledTimeLocal}: slot dentro finestra training.`
          : "Slot in finestra training.",
      };
    }

    return {
      slot: slotKey,
      targetKcalEcho: composed.targetKcal,
      items: composed.items.map((it, idx) => mapItem(it, slotKey, idx)),
      slotCoherence: slotCoherenceFor(slotKey, false),
      slotTimingRationale: meta?.scheduledTimeLocal
        ? `Pasto ${meta.labelIt} alle ${meta.scheduledTimeLocal} · target Diet ${composed.targetKcal} kcal.`
        : `Target Diet ${composed.targetKcal} kcal.`,
    };
  });

  const enrichedSlots = enrichMealSlotsAfterCompose({
    request,
    slots: preEnrichSlots,
    getBaseMealForSlot: (slotReq) => composedMealForSlot(production, slotReq),
  });

  const fuelNote = production.requirements.substrateFueling
    ? `Fueling V2: ${production.requirements.energy.fuelingKcal} kcal oral (CHO substrati).`
    : "";

  return {
    layer: "deterministic_meal_assembly_v1",
    disclaimer:
      `Piano generato con motore Nutrition V2 (staple sportivi + fueling substrati). ${fuelNote} Ripartizione pasti da Profile Diet.`,
    slots: enrichedSlots,
    dayInteractionSummary: dayInteractionSummaryExtras(
      request,
      [`Strategia ${production.requirements.strategyKind}`, fuelNote].filter(Boolean).join(" · "),
    ),
    mealRotationStaples: composedStaples(production),
    pathwayBoostStatus: pathwayBoostStatusFromRequest(request),
  };
}

function composedStaples(production: MealPlanV2Production): string[] {
  const staples: string[] = [];
  for (const slot of production.composedMealPlan) {
    for (const item of slot.items) {
      staples.push((item.canonicalKey ?? item.description).slice(0, 48).toLowerCase());
    }
  }
  return staples.slice(0, 24);
}

export async function mapV2PlanToV1Response(
  production: MealPlanV2Production,
  request: IntelligentMealPlanRequest,
): Promise<IntelligentMealPlanAssembledCore> {
  const core = mapV2PlanToV1AssembledCore(production, request);
  const fdcIds = new Set<number>();
  const canonicalKeys: string[] = [];

  for (const slot of core.slots) {
    for (const it of slot.items) {
      const key = it.compositionKey ?? "";
      if (key.startsWith("fdc:")) {
        const id = Number(key.slice(4));
        if (Number.isFinite(id) && id > 0) fdcIds.add(id);
      } else if (key && !key.startsWith("fdc:")) {
        canonicalKeys.push(key);
      }
    }
  }

  for (const slot of production.composedMealPlan) {
    for (const it of slot.items) {
      if (it.fdcId > 0) fdcIds.add(it.fdcId);
      if (it.canonicalKey) canonicalKeys.push(it.canonicalKey);
    }
  }

  const foodsByFdcId = fdcIds.size > 0 ? await loadFdcFoodsByIds([...fdcIds]) : new Map();
  const snapFdc = buildFdcCanonicalSnapshotFromFdcIds([...fdcIds], foodsByFdcId);
  const snapCanon = buildFdcCanonicalSnapshotFromFoods([...new Set(canonicalKeys)], foodsByFdcId);
  const snapshot = { ...snapCanon, ...snapFdc };

  return finalizeIntelligentMealPlanCore(core, request, snapshot);
}
