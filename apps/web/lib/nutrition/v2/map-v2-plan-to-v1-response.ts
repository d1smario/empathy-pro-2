import type {
  IntelligentMealPlanAssembledCore,
  IntelligentMealPlanItemOut,
  IntelligentMealPlanRequest,
  IntelligentMealPlanSlotOut,
  MealSlotKey,
} from "@/lib/nutrition/intelligent-meal-plan-types";
import { finalizeIntelligentMealPlanCore } from "@/lib/nutrition/meal-plan-response-finalize";
import type { MealPlanV2Production } from "@/lib/nutrition/v2/build-meal-plan-v2-production";

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
): IntelligentMealPlanItemOut {
  return {
    name: item.description,
    portionHint: `${Math.round(item.grams)} g`,
    functionalBridge: "USDA FDC · Nutrition V2",
    approxKcal: Math.round(item.kcal),
    macroRole: macroRoleFromItem(item.choG, item.proG, item.fatG),
    compositionKey: `fdc:${item.fdcId}`,
    compositionStatus: "fdc_cache",
  };
}

function slotCoherenceFor(slot: MealSlotKey, suppressed: boolean): string {
  if (suppressed) {
    return "Pasto soppresso: energia in finestra allenamento → modulo Fueling (substrati V2).";
  }
  return "Composizione deterministica Nutrition V2 da pool USDA taggati.";
}

export function mapV2PlanToV1AssembledCore(
  production: MealPlanV2Production,
  request: IntelligentMealPlanRequest,
): IntelligentMealPlanAssembledCore {
  const suppressed = new Set(request.suppressedSlots ?? []);
  const slotMeta = new Map(request.slots.map((s) => [s.slot, s]));

  const slots: IntelligentMealPlanSlotOut[] = production.composedMealPlan.map((composed) => {
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
      items: composed.items.map(mapItem),
      slotCoherence: slotCoherenceFor(slotKey, false),
      slotTimingRationale: meta?.scheduledTimeLocal
        ? `Pasto ${meta.labelIt} alle ${meta.scheduledTimeLocal} · target Diet ${composed.targetKcal} kcal.`
        : `Target Diet ${composed.targetKcal} kcal.`,
    };
  });

  const fuelNote = production.requirements.substrateFueling
    ? `Fueling V2: ${production.requirements.energy.fuelingKcal} kcal oral (CHO substrati).`
    : "";

  return {
    layer: "deterministic_meal_assembly_v1",
    disclaimer:
      `Piano generato con motore Nutrition V2 (USDA FDC taggato). ${fuelNote} Ripartizione pasti da Profile Diet.`,
    slots,
    dayInteractionSummary: [
      `Strategia ${production.requirements.strategyKind}`,
      `CHO totale target ${production.requirements.macros.total.choG} g`,
      fuelNote,
    ]
      .filter(Boolean)
      .join(" · ")
      .slice(0, 900),
    mealRotationStaples: composedStaples(production),
  };
}

function composedStaples(production: MealPlanV2Production): string[] {
  const staples: string[] = [];
  for (const slot of production.composedMealPlan) {
    for (const item of slot.items) {
      staples.push(item.description.slice(0, 48).toLowerCase());
    }
  }
  return staples.slice(0, 24);
}

export async function mapV2PlanToV1Response(
  production: MealPlanV2Production,
  request: IntelligentMealPlanRequest,
): Promise<IntelligentMealPlanAssembledCore> {
  const core = mapV2PlanToV1AssembledCore(production, request);
  return finalizeIntelligentMealPlanCore(core, request);
}
