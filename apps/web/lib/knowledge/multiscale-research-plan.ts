import type { KnowledgeResearchTraceSummary } from "@/api/knowledge/contracts";
import { getMultiscaleNode, metabolicLevelLabelIt } from "@empathy/domain-knowledge";
import type { ResearchPlan } from "@/lib/empathy/schemas";
import { buildKnowledgeResearchPlan } from "@/lib/knowledge/research-planner";
import type { MultiscalePathwayBridgeResult } from "@/lib/nutrition/multiscale-pathway-bridge";

export type BuildMultiscaleResearchPlanInput = {
  athleteId: string;
  anchorDate: string;
  bridge: MultiscalePathwayBridgeResult;
  plannedWorkoutId?: string | null;
};

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function traceMatchesPlan(summary: KnowledgeResearchTraceSummary, plan: ResearchPlan): boolean {
  const t = summary.trigger;
  const p = plan.trigger;
  if (normalizeText(t.module) !== normalizeText(p.module)) return false;
  if (normalizeText(t.sessionDate) !== normalizeText(p.sessionDate)) return false;
  if (normalizeText(t.kind) !== normalizeText(p.kind)) return false;
  if (normalizeText(t.entityLabel) && normalizeText(p.entityLabel)) {
    return normalizeText(t.entityLabel) === normalizeText(p.entityLabel);
  }
  return normalizeText(t.stimulusLabel) === normalizeText(p.stimulusLabel);
}

export function meetsMultiscaleResearchActivationGate(bridge: MultiscalePathwayBridgeResult): boolean {
  const { dominantBottleneck, activatedNodeIds } = bridge.bottleneck;
  return dominantBottleneck.score >= 0.45 || activatedNodeIds.length >= 6;
}

/** Piano bottleneck dominante + fino a 2 entità ontology (Interpretation — module nutrition). */
export function buildResearchPlanFromMultiscaleActivation(
  input: BuildMultiscaleResearchPlanInput,
): ResearchPlan[] {
  const { athleteId, anchorDate, bridge } = input;
  const level = bridge.bottleneck.dominantBottleneck.level;
  const scorePct = Math.round(bridge.bottleneck.dominantBottleneck.score * 100);
  const shared = {
    athleteId,
    sessionDate: anchorDate,
    plannedWorkoutId: input.plannedWorkoutId ?? undefined,
  };

  const plans: ResearchPlan[] = [
    buildKnowledgeResearchPlan({
      trigger: {
        kind: "modulation_followup",
        module: "nutrition",
        stimulusLabel: `${metabolicLevelLabelIt(level)} · score ${scorePct}%`,
        ...shared,
      },
    }),
  ];

  const entityIds = bridge.activatedNodeIds.filter((id) => !id.startsWith("scale.")).slice(0, 4);
  for (const nodeId of entityIds) {
    if (plans.length >= 3) break;
    const node = getMultiscaleNode(nodeId);
    if (!node) continue;
    plans.push(
      buildKnowledgeResearchPlan({
        trigger: {
          kind: "mechanism_entity",
          module: "nutrition",
          entityLabel: node.labelIt,
          stimulusLabel: `Multiscale · ${nodeId}`,
          ...shared,
        },
      }),
    );
  }

  return plans.slice(0, 3);
}

/** Piani da sincronizzare — dedup su summaries esistenti. */
export function plansToSyncFromMultiscaleActivation(
  input: BuildMultiscaleResearchPlanInput,
  existingSummaries: KnowledgeResearchTraceSummary[],
): ResearchPlan[] {
  if (!meetsMultiscaleResearchActivationGate(input.bridge)) return [];
  return buildResearchPlanFromMultiscaleActivation(input).filter(
    (plan) => !existingSummaries.some((summary) => traceMatchesPlan(summary, plan)),
  );
}

export function mergeResearchTraceSummaries(
  base: KnowledgeResearchTraceSummary[],
  synced: KnowledgeResearchTraceSummary[],
  limit = 4,
): KnowledgeResearchTraceSummary[] {
  const byId = new Map<string, KnowledgeResearchTraceSummary>();
  for (const row of [...synced, ...base]) {
    if (!byId.has(row.traceId)) byId.set(row.traceId, row);
  }
  return [...byId.values()]
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
    .slice(0, limit);
}
