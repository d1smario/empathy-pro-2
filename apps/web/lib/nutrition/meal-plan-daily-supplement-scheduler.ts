import type { NutritionPathwayModulationViewModel } from "@/api/nutrition/contracts";
import type {
  IntelligentMealPlanItemOut,
  IntelligentMealPlanRequestSlot,
  MealSlotKey,
} from "@/lib/nutrition/intelligent-meal-plan-types";
import type { MediterraneanDietType } from "@/lib/nutrition/mediterranean-meal-composer";
import {
  listNutrientPathwaySwapsForSlot,
  nutrientDisplayLabelIt,
  integrationActionForTarget,
} from "@/lib/nutrition/nutrient-pathway-slot-registry";
import {
  buildPathwayAbsorptionHints,
  slotPriorityForNutrientTarget,
} from "@/lib/nutrition/pathway-absorption-hints";
import type { NutrientTargetId } from "@/lib/nutrition/pathway-cofactors-to-nutrient-targets";

/** Quando assumere l'integratore rispetto al pasto scelto (modello PK / assorbimento). */
export type SupplementIntakeTiming = "before" | "with" | "after" | "away";

const TIMING_LABEL_IT: Record<SupplementIntakeTiming, string> = {
  before: "Prima del pasto",
  with: "Durante il pasto",
  after: "Dopo il pasto",
  away: "Lontano dal pasto",
};

const DEFAULT_SLOT_ORDER: MealSlotKey[] = [
  "breakfast",
  "lunch",
  "snack_pm",
  "dinner",
  "snack_am",
  "snack_evening",
];

const INTAKE_TIMING_BY_NUTRIENT: Partial<
  Record<NutrientTargetId, { timing: SupplementIntakeTiming; noteIt: string }>
> = {
  fe_mg: {
    timing: "away",
    noteIt: "1–2 h lontano da tè, caffè e latticini; abbinare vitamina C se indicato.",
  },
  vitB12_mcg: {
    timing: "with",
    noteIt: "Con un pasto che contenga proteine (assorbimento cobalamina).",
  },
  thiamineB1_mg: {
    timing: "with",
    noteIt: "Con carboidrati complessi a colazione o pranzo (cofattore PDH).",
  },
  folate_mcg: {
    timing: "with",
    noteIt: "Con pranzo o cena; se integrazione, non ripetere negli altri pasti.",
  },
  riboflavinB2_mg: { timing: "with", noteIt: "Con pasto misto (latticini/uova/pesce se tollerati)." },
  niacinB3_mg: { timing: "with", noteIt: "Con pasto principale; evitare dosi alte a stomaco vuoto." },
  vitB6_mg: { timing: "with", noteIt: "Con pasto leggero o principale." },
  mg_mg: {
    timing: "after",
    noteIt: "Preferenza serale/post-cena; distanziare da allenamento molto intenso.",
  },
  zn_mg: {
    timing: "away",
    noteIt: "Lontano da ferro, calcio e pasti molto ricchi di fibre.",
  },
  vitD_mcg: { timing: "with", noteIt: "Con pasto che includa grassi moderati (liposolubile)." },
  vitC_mg: { timing: "with", noteIt: "Con colazione o spuntino leggero." },
  se_mcg: { timing: "with", noteIt: "Con pasto principale; non superare soglie senza controllo." },
  omega3G: { timing: "with", noteIt: "Con pranzo/cena (grassi alimentari) o come da protocollo." },
  vitE_mg: { timing: "with", noteIt: "Con pasto contenente grassi insaturi." },
  fiberG: { timing: "with", noteIt: "Distribuire fibre negli alimenti dei pasti, non capsule ripetute." },
};

function nutrientHasFoodPathwayAnywhere(
  nutrientId: NutrientTargetId,
  dietType?: MediterraneanDietType,
): boolean {
  for (const slot of DEFAULT_SLOT_ORDER) {
    if (listNutrientPathwaySwapsForSlot(nutrientId, slot, dietType).length > 0) return true;
  }
  return false;
}

function resolveIntakeTiming(
  nutrientId: NutrientTargetId,
  vm: NutritionPathwayModulationViewModel | null | undefined,
): { timing: SupplementIntakeTiming; noteIt: string } {
  const pk = buildPathwayAbsorptionHints(vm).find((h) => h.nutrientId === nutrientId);
  const base = INTAKE_TIMING_BY_NUTRIENT[nutrientId] ?? {
    timing: "with" as const,
    noteIt: "Una sola assunzione giornaliera nel pasto indicato.",
  };
  if (pk?.avoidWith.length) {
    const avoid = pk.avoidWith.join(", ");
    if (base.timing === "with") {
      return {
        timing: "away",
        noteIt: `${base.noteIt} Evita contestualmente: ${avoid}.`,
      };
    }
    return { ...base, noteIt: `${base.noteIt} Evita: ${avoid}.` };
  }
  if (pk?.pairWith.length) {
    return { ...base, noteIt: `${base.noteIt} Preferisci: ${pk.pairWith.join(", ")}.` };
  }
  return base;
}

function pickSlotForNutrient(
  nutrientId: NutrientTargetId,
  slots: readonly IntelligentMealPlanRequestSlot[],
  suppressed: readonly MealSlotKey[],
  vm: NutritionPathwayModulationViewModel | null | undefined,
): IntelligentMealPlanRequestSlot | null {
  const available = slots.filter((s) => !suppressed.includes(s.slot));
  if (!available.length) return null;
  const priority = slotPriorityForNutrientTarget(
    nutrientId,
    vm,
    available.map((s) => s.slot),
  );
  for (const slotKey of priority) {
    const row = available.find((s) => s.slot === slotKey);
    if (row) return row;
  }
  return available[0] ?? null;
}

function buildScheduledIntegrationItem(
  nutrientId: NutrientTargetId,
  slot: IntelligentMealPlanRequestSlot,
  vm: NutritionPathwayModulationViewModel | null | undefined,
): IntelligentMealPlanItemOut {
  const label = nutrientDisplayLabelIt(nutrientId);
  const action = integrationActionForTarget(nutrientId, label);
  const { timing, noteIt } = resolveIntakeTiming(nutrientId, vm);
  const timingLabel = TIMING_LABEL_IT[timing];
  const mealLabel = slot.labelIt?.trim() || slot.slot;
  const time = slot.scheduledTimeLocal?.trim() || "—";
  const portionHint =
    `${timingLabel} · ${mealLabel} ${time}. ${action}`.slice(0, 160);
  const functionalBridge =
    `Integrazione giornaliera (1×/giorno): ${timingLabel.toLowerCase()} — ${mealLabel} alle ${time}. ${noteIt} ${action}`.slice(
      0,
      500,
    );
  return {
    name: `Integrazione giornaliera: ${label}`,
    portionHint,
    approxKcal: 12,
    macroRole: "mixed",
    functionalBridge,
  };
}

export type DailySupplementIntegrationPlan = Partial<Record<MealSlotKey, IntelligentMealPlanItemOut[]>>;

/**
 * Una sola voce integrazione per nutriente/giorno, nello slot migliore (PK pathway + orari routine).
 * Se il nutriente è copribile con alimenti pathway in almeno uno slot → nessuna voce integrazione
 * (sostituzione/contorno gestito dall'advisor su pranzo/cena).
 */
export function buildDailySupplementIntegrationPlan(input: {
  boostTargets: Array<{ nutrientId: NutrientTargetId; labelIt: string }>;
  slots: readonly IntelligentMealPlanRequestSlot[];
  suppressedSlots?: readonly MealSlotKey[];
  pathwayModulation?: NutritionPathwayModulationViewModel | null;
  dietType?: MediterraneanDietType;
}): DailySupplementIntegrationPlan {
  const suppressed = input.suppressedSlots ?? [];
  const plan: DailySupplementIntegrationPlan = {};
  const assignedNutrients = new Set<NutrientTargetId>();

  for (const target of input.boostTargets) {
    const id = target.nutrientId;
    if (assignedNutrients.has(id)) continue;
    if (nutrientHasFoodPathwayAnywhere(id, input.dietType)) continue;

    const slot = pickSlotForNutrient(id, input.slots, suppressed, input.pathwayModulation);
    if (!slot) continue;

    const item = buildScheduledIntegrationItem(id, slot, input.pathwayModulation);
    const list = plan[slot.slot] ?? [];
    list.push(item);
    plan[slot.slot] = list;
    assignedNutrients.add(id);
  }

  return plan;
}

/** Conta voci integrazione su tutti gli slot (guardrail test). */
export function countDailyIntegrationItems(plan: DailySupplementIntegrationPlan): number {
  return Object.values(plan).reduce((n, items) => n + (items?.length ?? 0), 0);
}
