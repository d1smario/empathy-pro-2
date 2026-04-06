import type { KnowledgeResearchTraceListViewModel } from "@/api/knowledge/contracts";
import { buildSupabaseAuthHeaders } from "@/lib/auth/client-auth";
import { fetchWithTimeout } from "@/lib/http/fetch-with-timeout";

export async function fetchKnowledgeResearchTracesExpanded(
  athleteId: string,
  options?: { limit?: number },
): Promise<KnowledgeResearchTraceListViewModel> {
  const limit = Math.max(1, Math.min(50, options?.limit ?? 12));
  const url = `/api/knowledge/research-traces?athleteId=${encodeURIComponent(athleteId)}&expand=expansion&limit=${limit}`;
  const response = await fetchWithTimeout(url, {
    method: "GET",
    headers: await buildSupabaseAuthHeaders({ "Content-Type": "application/json" }),
    cache: "no-store",
  });
  const payload = (await response.json().catch(() => ({}))) as KnowledgeResearchTraceListViewModel & { error?: string };
  if (!response.ok) {
    return {
      athleteId,
      traces: [],
      expansionTraces: [],
      error: payload.error ?? "Research traces fetch failed",
    };
  }
  return {
    athleteId: payload.athleteId ?? athleteId,
    traces: payload.traces ?? [],
    expansionTraces: payload.expansionTraces ?? [],
    error: payload.error ?? null,
  };
}
