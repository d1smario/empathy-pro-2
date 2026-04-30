import type {
  FunctionalFoodRecommendationsViewModel,
  FunctionalFoodTargetViewModel,
  FunctionalMealSelectorSlotViewModel,
  FunctionalMealSelectorViewModel,
  NutritionPathwayModulationViewModel,
  NutritionPerformanceIntegrationDials,
} from "@/api/nutrition/contracts";

type AdaptationLoopLike = {
  status?: "aligned" | "watch" | "regenerate" | string;
  nextAction?: string | null;
} | null;

type RecoveryLike = {
  status?: "good" | "moderate" | "poor" | "unknown";
} | null;

type TwinLike = {
  readiness?: number | null;
  redoxStressIndex?: number | null;
  inflammationRisk?: number | null;
  glycogenStatus?: number | null;
} | null;

const SLOT_ORDER: FunctionalMealSelectorSlotViewModel["slot"][] = ["breakfast", "snack_am", "lunch", "snack_pm", "dinner"];

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function uniq(items: string[]): string[] {
  return Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));
}

function targetElements(target: FunctionalFoodTargetViewModel): string[] {
  return uniq([
    target.displayNameIt,
    target.kind === "amino_acid" ? "aminoacidi" : "",
    target.kind === "fatty_acid" ? "acidi grassi" : "",
    target.kind === "mineral" ? "minerali" : "",
    target.kind === "vitamin" ? "vitamine" : "",
  ]);
}

function targetsMatching(targets: FunctionalFoodTargetViewModel[], rx: RegExp): FunctionalFoodTargetViewModel[] {
  return targets.filter((target) => rx.test(`${target.nutrientId} ${target.displayNameIt} ${target.rationaleIt}`));
}

function candidatesFromTargets(
  targets: FunctionalFoodTargetViewModel[],
  timing: FunctionalMealSelectorSlotViewModel["candidates"][number]["timing"],
  limit: number,
  caution: string | null = null,
): FunctionalMealSelectorSlotViewModel["candidates"] {
  const out: FunctionalMealSelectorSlotViewModel["candidates"] = [];
  for (const target of targets) {
    for (const example of target.curatedExamples) {
      out.push({
        name: example.name,
        reason: example.why,
        functionalElements: targetElements(target),
        timing,
        caution,
      });
      if (out.length >= limit) return out;
    }
  }
  return out;
}

function fallbackCandidates(focus: FunctionalMealSelectorSlotViewModel["focus"]): FunctionalMealSelectorSlotViewModel["candidates"] {
  if (focus === "glycogen") {
    return [
      {
        name: "Riso / patate + fonte proteica magra",
        reason: "CHO digeribili + aminoacidi per ripristino glicogeno e segnale anabolico.",
        functionalElements: ["amidi", "leucina", "potassio"],
        timing: "early_recovery",
      },
    ];
  }
  if (focus === "redox") {
    return [
      {
        name: "Kiwi / agrumi + pesce azzurro nel pasto",
        reason: "Vitamina C e omega-3 alimentari per supporto redox e infiammatorio.",
        functionalElements: ["vitamina C", "EPA/DHA", "polifenoli"],
        timing: "daily",
      },
    ];
  }
  if (focus === "microbiota_gut") {
    return [
      {
        name: "Yogurt/kefir o legumi tollerati lontano dall'intenso",
        reason: "Supporto barriera e microbiota, mantenendo timing lontano dalla finestra ad alto stress GI.",
        functionalElements: ["fermentati", "fibre", "glutammina alimentare"],
        timing: "late_recovery",
        caution: "Evitare nuovi fermentati nelle 24 h pre-evento chiave.",
      },
    ];
  }
  return [
    {
      name: "Pasto misto completo",
      reason: "Base alimentare equilibrata quando non emerge un vincolo metabolico dominante.",
      functionalElements: ["CHO", "proteine", "micronutrienti"],
      timing: "daily",
    },
  ];
}

function makeSlot(input: {
  slot: FunctionalMealSelectorSlotViewModel["slot"];
  focus: FunctionalMealSelectorSlotViewModel["focus"];
  phase: FunctionalMealSelectorSlotViewModel["metabolicPhase"];
  rationale: string;
  candidates: FunctionalMealSelectorSlotViewModel["candidates"];
}): FunctionalMealSelectorSlotViewModel {
  return {
    slot: input.slot,
    focus: input.focus,
    metabolicPhase: input.phase,
    rationale: input.rationale,
    candidates: input.candidates.length ? input.candidates : fallbackCandidates(input.focus),
  };
}

export function buildFunctionalMealSelectorViewModel(input: {
  date: string;
  pathwayModulation: NutritionPathwayModulationViewModel | null;
  foodRecommendations: FunctionalFoodRecommendationsViewModel | null;
  nutritionPerformanceIntegration: NutritionPerformanceIntegrationDials | null;
  adaptationLoop: AdaptationLoopLike;
  recoverySummary: RecoveryLike;
  twin: TwinLike;
}): FunctionalMealSelectorViewModel {
  const targets = input.foodRecommendations?.targets ?? [];
  const pathwayLabels = input.pathwayModulation?.pathways.map((pathway) => pathway.pathwayLabel.toLowerCase()) ?? [];
  const readiness = asNumber(input.twin?.readiness) ?? 65;
  const redox = asNumber(input.twin?.redoxStressIndex) ?? 0;
  const inflammation = asNumber(input.twin?.inflammationRisk) ?? 0;
  const glycogen = asNumber(input.twin?.glycogenStatus) ?? 55;
  const recoveryPoor = input.recoverySummary?.status === "poor" || readiness < 50;
  const loopStatus = input.adaptationLoop?.status ?? "aligned";
  const status: FunctionalMealSelectorViewModel["status"] =
    recoveryPoor ? "recover" : loopStatus === "regenerate" ? "adapt" : loopStatus === "watch" ? "support" : "baseline";

  const glycogenTargets = targetsMatching(targets, /leucine|leucina|magnesium|magnesio|potassium|potassio|thiamine|tiamina|b1/i);
  const redoxTargets = targetsMatching(targets, /redox|vitamin_c|vitamina c|omega|zinc|zinco|selen|nitrate|nitrati|niacin|niacina|b3/i);
  const gutTargets = targetsMatching(targets, /gut|barrier|microbiota|glutamine|glutammina|folate|folati/i);
  const anabolicTargets = targetsMatching(targets, /leucine|leucina|protein|proteina|amino/i);

  const slots: FunctionalMealSelectorSlotViewModel[] = [];
  const dominantRedox = redox >= 55 || inflammation >= 55 || pathwayLabels.some((label) => label.includes("redox"));
  const lowGlycogen = glycogen < 48 || pathwayLabels.some((label) => label.includes("glicogeno"));
  const gutFocus = pathwayLabels.some((label) => label.includes("intest") || label.includes("microbiota") || label.includes("gut"));

  slots.push(
    makeSlot({
      slot: "breakfast",
      focus: dominantRedox ? "redox" : "maintenance",
      phase: "daily_support",
      rationale: dominantRedox
        ? "Avvio giornata orientato a polifenoli, vitamina C e cofattori redox se il grafo/twin segnala stress ossidativo o infiammatorio."
        : "Base micronutriente stabile: evita che il piano dipenda solo dal pasto post-seduta.",
      candidates: candidatesFromTargets(dominantRedox ? redoxTargets : targets.slice(0, 3), "daily", 3),
    }),
  );

  slots.push(
    makeSlot({
      slot: "snack_am",
      focus: lowGlycogen ? "glycogen" : "microbiota_gut",
      phase: "pre_load",
      rationale: lowGlycogen
        ? "Se glicogeno o disponibilita' substrati sono bassi, privilegia CHO digeribili e potassio prima dello stimolo."
        : "Su giorni non glicolitici, sposta fibre/fermentati lontano dall'intensita'.",
      candidates: candidatesFromTargets(lowGlycogen ? glycogenTargets : gutTargets, lowGlycogen ? "pre" : "daily", 3),
      }),
  );

  slots.push(
    makeSlot({
      slot: "lunch",
      focus: lowGlycogen ? "glycogen" : "anabolic",
      phase: "early_recovery",
      rationale: "Pasto principale come blocco di ricarica: CHO, leucina e cofattori per allineare costo energetico e recupero.",
      candidates: candidatesFromTargets([...glycogenTargets, ...anabolicTargets], "early_recovery", 4),
    }),
  );

  slots.push(
    makeSlot({
      slot: "snack_pm",
      focus: recoveryPoor ? "catabolic_recovery" : dominantRedox ? "redox" : "maintenance",
      phase: recoveryPoor ? "early_recovery" : "daily_support",
      rationale: recoveryPoor
        ? "Readiness bassa: snack orientato a proteine/CHO senza stress digestivo eccessivo."
        : "Slot di modulazione fine tra redox e mantenimento energetico.",
      candidates: candidatesFromTargets(recoveryPoor ? [...anabolicTargets, ...glycogenTargets] : redoxTargets, recoveryPoor ? "early_recovery" : "daily", 3),
    }),
  );

  slots.push(
    makeSlot({
      slot: "dinner",
      focus: gutFocus ? "microbiota_gut" : dominantRedox ? "redox" : "catabolic_recovery",
      phase: "late_recovery",
      rationale: "Cena come recovery tardiva: riparazione, sonno, barriera intestinale e attenuazione infiammatoria.",
      candidates: candidatesFromTargets(gutFocus ? gutTargets : dominantRedox ? redoxTargets : [...anabolicTargets, ...gutTargets], "late_recovery", 4),
    }),
  );

  return {
    modelVersion: 1,
    layer: "deterministic_functional_food_selector",
    date: input.date,
    status,
    slots: slots.filter((slot, index) => SLOT_ORDER[index] === slot.slot),
    notes: [
      "Selettore deterministico: propone alimenti/categorie funzionali, non sostituisce il solver kcal/macro o USDA FDC.",
      "I numeri nutrizionali finali restano da catalogo USDA/diario; questi candidati spiegano il perche' biologico del cibo scelto.",
      ...(input.nutritionPerformanceIntegration?.rationale.slice(0, 3) ?? []),
    ],
  };
}
