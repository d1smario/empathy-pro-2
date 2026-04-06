import type {
  FunctionalFoodTargetViewModel,
  NutritionPathwayHalfLifeClass,
  NutritionPathwaySupportItem,
} from "@/api/nutrition/contracts";
import type { UsdaRichFoodItemViewModel } from "@/api/nutrition/contracts";
import type {
  IntelligentMealPlanFoodOptionRef,
  IntelligentMealPlanFunctionalFoodGroup,
} from "@/lib/nutrition/intelligent-meal-plan-types";
import { shortFoodLabelFromUsda } from "@/lib/nutrition/usda-food-label";

function halfLifeLabelIt(c: NutritionPathwayHalfLifeClass): string {
  switch (c) {
    case "minutes_acute":
      return "segnale acuto (ordine minuti)";
    case "hours_signal":
      return "ore (segnale metabolico)";
    case "hours_extended":
      return "ore (finestra estesa)";
    case "circadian":
      return "ritmo circadiano";
    default:
      return String(c);
  }
}

/** Collega target nutriente ↔ fasi pathway (emivita qualitativa, non PK molecolare). */
export function buildTimingHalfLifeHintForTarget(
  t: FunctionalFoodTargetViewModel,
  pathways: NutritionPathwaySupportItem[],
): string {
  const ids = new Set(t.pathwayIds);
  const relevant = pathways.filter((p) => ids.has(p.id));
  if (!relevant.length) {
    return "Allinea il pasto all’orario dello slot e al carico del giorno; il supporto ai cofattori non è istantaneo.";
  }
  const chunks: string[] = [];
  for (const p of relevant) {
    for (const ph of p.phases) {
      const hl = halfLifeLabelIt(ph.halfLifeClass);
      const act = ph.actions[0] ?? "";
      chunks.push(`${ph.windowLabel} (${hl})${act ? `: ${act}` : ""}`);
    }
  }
  const joined = chunks.slice(0, 5).join(" · ");
  return joined.length > 380 ? `${joined.slice(0, 377)}…` : joined;
}

function optionKey(source: IntelligentMealPlanFoodOptionRef["source"], label: string, fdcId: number | null): string {
  return `${source}:${fdcId ?? ""}:${label.toLowerCase()}`;
}

/**
 * Per ogni target funzionale: 3–5 opzioni (esempi curati + righe USDA dense sul nutriente FDC).
 * USDA senza match esplicito viene distribuito come riempitivo solo se mancano opzioni.
 */
export function buildFunctionalFoodOptionGroupsForSlot(input: {
  pathwayTargets: FunctionalFoodTargetViewModel[];
  usdaFoods: UsdaRichFoodItemViewModel[];
  pathwaySupportPathways?: NutritionPathwaySupportItem[] | null;
  minPerGroup?: number;
  maxPerGroup?: number;
}): IntelligentMealPlanFunctionalFoodGroup[] {
  const pathways = input.pathwaySupportPathways ?? [];
  const minG = Math.max(1, Math.min(5, input.minPerGroup ?? 3));
  const maxG = Math.max(minG, Math.min(6, input.maxPerGroup ?? 5));
  const foods = input.usdaFoods ?? [];
  const usedFdc = new Set<number>();

  const groups: IntelligentMealPlanFunctionalFoodGroup[] = [];

  for (const t of input.pathwayTargets) {
    const opts: IntelligentMealPlanFoodOptionRef[] = [];
    const seen = new Set<string>();

    const push = (o: IntelligentMealPlanFoodOptionRef) => {
      const k = optionKey(o.source, o.label, o.fdcId);
      if (seen.has(k)) return;
      seen.add(k);
      opts.push(o);
    };

    for (const ex of t.curatedExamples ?? []) {
      if (opts.length >= maxG) break;
      const name = ex.name.trim();
      if (!name) continue;
      push({ source: "curated", label: name, rationale: ex.why.trim() || "Esempio curato per il target.", fdcId: null });
    }

    const nid = t.usdaRichSearch?.fdcNutrientId;
    const matching =
      nid != null
        ? foods.filter((f) => f.targetNutrientId === nid && !usedFdc.has(f.fdcId))
        : foods.filter((f) => !usedFdc.has(f.fdcId));

    for (const f of matching) {
      if (opts.length >= maxG) break;
      usedFdc.add(f.fdcId);
      const lbl = shortFoodLabelFromUsda(f.description, 48);
      const dens =
        f.targetAmountPer100g != null && f.targetUnitName
          ? `${f.targetAmountPer100g} ${f.targetUnitName}/100 g`
          : "densità nutriente in USDA";
      push({
        source: "usda_fdc",
        label: lbl,
        rationale: `USDA FDC #${f.fdcId} — allineato a ${t.displayNameIt} (${dens}).`,
        fdcId: f.fdcId,
      });
    }

    if (opts.length < minG && nid == null) {
      for (const f of foods) {
        if (opts.length >= minG) break;
        if (usedFdc.has(f.fdcId)) continue;
        usedFdc.add(f.fdcId);
        const lbl = shortFoodLabelFromUsda(f.description, 48);
        push({
          source: "usda_fdc",
          label: lbl,
          rationale: `USDA FDC #${f.fdcId} — candidato generico per lo slot (associa al target ${t.displayNameIt} se sensato).`,
          fdcId: f.fdcId,
        });
      }
    }

    const rationaleShort =
      t.rationaleIt.length > 200 ? `${t.rationaleIt.slice(0, 197)}…` : t.rationaleIt;

    groups.push({
      nutrientId: t.nutrientId,
      displayNameIt: t.displayNameIt,
      pathwayLabel: t.pathwayLabel,
      rationaleShort,
      timingHalfLifeHint: buildTimingHalfLifeHintForTarget(t, pathways),
      options: opts,
    });
  }

  return groups;
}
