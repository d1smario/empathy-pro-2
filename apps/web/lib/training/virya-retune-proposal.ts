import type { ApprovedApplicationPatch } from "@/lib/dashboard/resolve-operational-signals-bundle";
import type { AthleteEvidenceMemoryItem } from "@/lib/empathy/schemas";
import { COACH_APPLICATION_EVIDENCE_SOURCE } from "@/lib/memory/coach-application-traces";
import type { AdaptationRegenerationLoop } from "@/lib/training/adaptation-regeneration-loop";

export type ViryaRetuneProposalVm = {
  version: "v1";
  recommendedMode: string;
  loadScaleSuggestion: number;
  sessionDeltaSuggestion: number;
  linkedPatchIds: string[];
  linkedCoachTraceIds: string[];
  rationaleLines: string[];
};

function clamp01(n: number): number {
  return Math.max(0.55, Math.min(1, n));
}

function coachTraceIdsForTraining(items: AthleteEvidenceMemoryItem[] | undefined): string[] {
  if (!items?.length) return [];
  return items
    .filter(
      (item) =>
        item.source === COACH_APPLICATION_EVIDENCE_SOURCE && (item.module === "training" || item.module === "physiology"),
    )
    .map((item) => item.id)
    .filter((id): id is string => typeof id === "string" && id.length > 0)
    .slice(0, 12);
}

export function buildViryaRetuneProposalVm(input: {
  directiveRecommendedMode: string;
  adaptationLoop: AdaptationRegenerationLoop;
  viryaPatches: ApprovedApplicationPatch[];
  coachEvidenceItems?: AthleteEvidenceMemoryItem[];
}): ViryaRetuneProposalVm {
  const applied = input.viryaPatches.filter((p) => p.status === "applied");
  const pending = input.viryaPatches.filter((p) => p.status === "pending");
  const active = applied.length ? applied : pending;
  const linkedPatchIds = active.map((p) => p.id).filter(Boolean);

  let loadScaleSuggestion = 1;
  if (input.adaptationLoop.status === "regenerate") loadScaleSuggestion = 0.72;
  else if (input.adaptationLoop.status === "watch") loadScaleSuggestion = 0.88;
  else loadScaleSuggestion = 0.95;

  let sessionDeltaSuggestion = 0;
  if (input.directiveRecommendedMode.includes("regeneration")) sessionDeltaSuggestion = -1;
  else if (input.directiveRecommendedMode.includes("reduction")) sessionDeltaSuggestion = -1;
  else if (input.directiveRecommendedMode.includes("fueling")) sessionDeltaSuggestion = 0;

  const rationaleLines = [
    `Directive mode: ${input.directiveRecommendedMode}.`,
    `Adaptation loop: ${input.adaptationLoop.status} · ${input.adaptationLoop.nextAction}.`,
    active.length ? `${active.length} patch VIRYA/training attivi nel bundle.` : "Nessun patch VIRYA dedicato; solo loop twin/recovery.",
    "Materializzazione sessione: sempre Builder singola; calendario solo dopo salvataggio coach.",
  ];

  return {
    version: "v1",
    recommendedMode: input.directiveRecommendedMode,
    loadScaleSuggestion: clamp01(loadScaleSuggestion),
    sessionDeltaSuggestion,
    linkedPatchIds,
    linkedCoachTraceIds: coachTraceIdsForTraining(input.coachEvidenceItems),
    rationaleLines,
  };
}
