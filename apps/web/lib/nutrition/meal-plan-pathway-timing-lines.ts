import type { NutritionPathwayModulationViewModel } from "@/api/nutrition/contracts";

/** Righe compatte per LLM: fasi, finestre, classe emivita qualitativa. */
export function buildPathwayTimingLinesForMealPlan(vm: NutritionPathwayModulationViewModel | null | undefined): string[] {
  if (!vm?.pathways?.length) return [];
  const out: string[] = [];
  for (const p of vm.pathways) {
    for (const ph of p.phases) {
      const acts = ph.actions.filter(Boolean).slice(0, 2).join("; ");
      out.push(
        `[${p.pathwayLabel}] fase=${ph.phase}, finestra=${ph.windowLabel}, emivita_qualitativa=${ph.halfLifeClass}${acts ? ` — ${acts}` : ""}`,
      );
    }
  }
  return out.slice(0, 28);
}
