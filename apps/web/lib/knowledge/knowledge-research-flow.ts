import type { KnowledgeResearchTraceSummary } from "@/api/knowledge/contracts";
import type {
  KnowledgeExpansionTrace,
  ResearchHopTrace,
  ResearchPlan,
} from "@/lib/empathy/schemas";
import { resolveKnowledgeTraceHopLinks } from "@/lib/knowledge/knowledge-corpus-resolver";
import {
  getKnowledgeExpansionTraceHopContext,
  linkKnowledgeExpansionTraceHop,
  persistKnowledgeExpansionTrace,
  summarizeKnowledgeExpansionTrace,
} from "@/lib/knowledge/knowledge-research-trace-store";

function replaceTraceHop(trace: KnowledgeExpansionTrace, updatedHop: ResearchHopTrace): KnowledgeExpansionTrace {
  return {
    ...trace,
    updatedAt: new Date().toISOString(),
    hops: trace.hops.map((hop) => (hop.traceHopId === updatedHop.traceHopId ? updatedHop : hop)),
  };
}

function pickCanonicalHop(trace: KnowledgeExpansionTrace) {
  return trace.hops.find((hop) => hop.hopId === "hop-literature") ?? trace.hops[0] ?? null;
}

export async function autoLinkCanonicalResearchTrace(
  trace: KnowledgeExpansionTrace,
): Promise<KnowledgeResearchTraceSummary> {
  const hop = pickCanonicalHop(trace);
  if (!hop) return summarizeKnowledgeExpansionTrace(trace);

  const resolved = await resolveKnowledgeTraceHopLinks({ trace, hop });
  const updatedHop = await linkKnowledgeExpansionTraceHop({
    traceHopId: hop.traceHopId,
    status: resolved.status,
    resultSummary: resolved.resultSummary,
    documentIds: resolved.documentIds,
    assertionIds: resolved.assertionIds,
  });

  return summarizeKnowledgeExpansionTrace(replaceTraceHop(trace, updatedHop));
}

/**
 * Resolves every hop still in `planned` against the persisted knowledge corpus (same search path as literature).
 * Operational goal: each layer (stimulus, mechanisms/metabolic, projection) gets evidence links when the corpus has matches.
 */
export async function autoLinkAllPlannedResearchTraceHops(
  trace: KnowledgeExpansionTrace,
): Promise<KnowledgeResearchTraceSummary> {
  let current = trace;
  const ordered = [...current.hops].sort((a, b) => {
    const order = ["hop-literature", "hop-mechanisms", "hop-reactions", "hop-projection"];
    const ia = order.indexOf(a.hopId);
    const ib = order.indexOf(b.hopId);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  for (const hop of ordered) {
    if (hop.status !== "planned") continue;
    try {
      const resolved = await resolveKnowledgeTraceHopLinks({ trace: current, hop });
      const updatedHop = await linkKnowledgeExpansionTraceHop({
        traceHopId: hop.traceHopId,
        status: resolved.status,
        resultSummary: resolved.resultSummary,
        documentIds: resolved.documentIds,
        assertionIds: resolved.assertionIds,
      });
      current = replaceTraceHop(current, updatedHop);
    } catch {
      // Leave hop planned so a later manual hop-link retry can run.
    }
  }

  return summarizeKnowledgeExpansionTrace(current);
}

export async function persistCanonicalResearchTracePlan(
  plan: ResearchPlan,
): Promise<KnowledgeResearchTraceSummary> {
  const trace = await persistKnowledgeExpansionTrace(plan);
  try {
    return await autoLinkAllPlannedResearchTraceHops(trace);
  } catch {
    return summarizeKnowledgeExpansionTrace(trace);
  }
}

export async function resolveAndLinkKnowledgeTraceHopById(traceHopId: string): Promise<{
  hop: ResearchHopTrace;
  traceSummary: KnowledgeResearchTraceSummary;
} | null> {
  const context = await getKnowledgeExpansionTraceHopContext(traceHopId);
  if (!context) return null;

  const resolved = await resolveKnowledgeTraceHopLinks(context);
  const hop = await linkKnowledgeExpansionTraceHop({
    traceHopId,
    status: resolved.status,
    resultSummary: resolved.resultSummary,
    documentIds: resolved.documentIds,
    assertionIds: resolved.assertionIds,
  });

  return {
    hop,
    traceSummary: summarizeKnowledgeExpansionTrace(replaceTraceHop(context.trace, hop)),
  };
}
