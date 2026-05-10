import type { KnowledgeResearchTraceSummary } from "@/api/knowledge/contracts";
import type { ResearchPlan } from "@/lib/empathy/schemas";
import { autoLinkAllPlannedResearchTraceHops } from "@/lib/knowledge/knowledge-research-flow";
import { isMissingKnowledgeFoundationError } from "@/lib/knowledge/knowledge-foundation";
import {
  persistKnowledgeExpansionTrace,
  summarizeKnowledgeExpansionTrace,
} from "@/lib/knowledge/knowledge-research-trace-store";

/**
 * Single convoy for VIRYA (and batch POST research-traces): persist deduped trace rows,
 * then link hops only when any hop is still `planned` (skips redundant corpus work on re-fetch).
 */
export async function syncResearchTracePlans(plans: ResearchPlan[]): Promise<KnowledgeResearchTraceSummary[]> {
  const researchTraces: KnowledgeResearchTraceSummary[] = [];
  const results = await Promise.allSettled(
    plans.map(async (plan) => {
      const trace = await persistKnowledgeExpansionTrace(plan);
      const hasPlanned = trace.hops.some((h) => h.status === "planned");
      if (!hasPlanned) {
        return summarizeKnowledgeExpansionTrace(trace);
      }
      return autoLinkAllPlannedResearchTraceHops(trace);
    }),
  );

  for (const result of results) {
    if (result.status === "fulfilled") {
      researchTraces.push(result.value);
      continue;
    }
    if (!isMissingKnowledgeFoundationError(result.reason)) {
      console.error("research trace sync failed", result.reason);
    }
  }

  return researchTraces;
}
