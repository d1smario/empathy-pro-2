import type {
  Pro2BuilderSessionContract,
  Pro2SessionInterpretation,
  Pro2SessionInterpretationSector,
} from "@/lib/training/builder/pro2-session-contract";
import type { SessionAnalysisFacetCategory } from "@/api/training/contracts";
import { buildSessionMultilevelAnalysisStrip } from "@/lib/training/session-multilevel-analysis-strip";

function pathwayDirection(
  source: string,
): "forward" | "reverse" {
  return source === "load_proxy" || source === "session_knowledge" ? "reverse" : "forward";
}

function interpretationFromContract(
  contract: Pro2BuilderSessionContract,
  fallback?: { tss?: number; durationMin?: number },
): Pro2SessionInterpretation {
  const durMin =
    fallback?.durationMin ??
    (contract.summary?.durationSec
      ? Math.max(1, Math.round(contract.summary.durationSec / 60))
      : contract.plannedSessionDurationMinutes ?? 0);
  const tssFallback = fallback?.tss ?? contract.summary?.tss ?? 0;

  const vm = buildSessionMultilevelAnalysisStrip({
    contract,
    fallbackTss: tssFallback,
    fallbackDurationMin: durMin > 0 ? durMin : undefined,
  });

  const sectors: Pro2SessionInterpretationSector[] = vm.stripSlots
    .filter((s) => s.valueLineIt !== "—")
    .map((s) => {
      const pills = vm.facets
        .filter((f) => f.category === s.category)
        .slice(0, 3)
        .map((f) => ({
          id: f.id,
          text: f.pillLabelIt,
          direction: pathwayDirection(f.source),
        }));
      return {
        category: s.category,
        shortLabelIt: s.shortLabelIt,
        valueLineIt: s.valueLineIt,
        detailHintIt: s.detailHintIt,
        facetId: s.facetId,
        pathwayPills: pills.length > 0 ? pills : undefined,
      };
    });

  return {
    modelVersion: 1,
    layer: "deterministic_session_facet_template",
    coachPrompts: vm.coachPrompts,
    facilitationHints: vm.facilitationHints,
    sectors,
    generatedAt: new Date().toISOString(),
  };
}

/** Attacca / aggiorna `sessionInterpretation` sul contratto (persist notes, libreria, seed). */
export function preparePro2BuilderSessionContractForPersist(
  contract: Pro2BuilderSessionContract,
  fallback?: { tss?: number; durationMin?: number },
): Pro2BuilderSessionContract {
  return {
    ...contract,
    sessionInterpretation: interpretationFromContract(contract, fallback),
  };
}

/** Template libreria legacy senza interpretation: calcola al volo per anteprima. */
export function ensurePro2BuilderSessionInterpretation(
  contract: Pro2BuilderSessionContract,
  fallback?: { tss?: number; durationMin?: number },
): Pro2BuilderSessionContract {
  if (contract.sessionInterpretation?.modelVersion === 1 && contract.sessionInterpretation.sectors.length > 0) {
    return contract;
  }
  return preparePro2BuilderSessionContractForPersist(contract, fallback);
}

export function viewModelFromSessionInterpretation(
  interpretation: Pro2SessionInterpretation,
): ReturnType<typeof buildSessionMultilevelAnalysisStrip> {
  const stripSlots = interpretation.sectors.map((s) => ({
    category: s.category as SessionAnalysisFacetCategory,
    shortLabelIt: s.shortLabelIt,
    valueLineIt: s.valueLineIt,
    detailHintIt: s.detailHintIt,
    facetId: s.facetId,
  }));

  return {
    modelVersion: 1,
    layer: "deterministic_session_facet_template",
    facets: [],
    stripSlots,
    notes: [
      "Snapshot interpretazione dal contratto (domande coach e settori al momento del salvataggio).",
      "Ricalcolo live se il contratto non include sessionInterpretation.",
    ],
    coachPrompts: interpretation.coachPrompts,
    facilitationHints: interpretation.facilitationHints,
  };
}
