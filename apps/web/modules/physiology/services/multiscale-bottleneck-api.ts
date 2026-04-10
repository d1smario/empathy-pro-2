import { buildSupabaseAuthHeaders } from "@/lib/auth/client-auth";
import type { MultiscaleBottleneckApiOk } from "@/lib/knowledge/multiscale-bottleneck-contract";
import { fetchWithTimeout } from "@/lib/http/fetch-with-timeout";

export async function fetchMultiscaleBottleneck(athleteId: string, options?: { includeSubgraph?: boolean }) {
  const q = new URLSearchParams({ athleteId });
  if (options?.includeSubgraph) q.set("includeSubgraph", "1");
  const response = await fetchWithTimeout(`/api/knowledge/multiscale-bottleneck?${q.toString()}`, {
    method: "GET",
    headers: await buildSupabaseAuthHeaders({ "Content-Type": "application/json" }),
  });
  const body = (await response.json().catch(() => ({}))) as MultiscaleBottleneckApiOk | { ok?: false; error?: string };
  if (!response.ok || !body || (body as { ok?: boolean }).ok !== true) {
    throw new Error((body as { error?: string }).error ?? "Fetch multiscale bottleneck failed");
  }
  return body as MultiscaleBottleneckApiOk;
}
