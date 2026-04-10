import { buildSupabaseAuthHeaders } from "@/lib/auth/client-auth";

export type PhysiologyLabResult = {
  engine: "lactate" | "oxidation" | "metabolic";
  version: string;
  state: string;
  values: Record<string, number | string>;
};

export type PhysiologyViewModel = {
  athleteId: string;
  computedAt: string;
  results: PhysiologyLabResult[];
};

export async function fetchPhysiologyViewModel(
  athleteId: string,
): Promise<PhysiologyViewModel & { error?: string | null }> {
  const response = await fetch(`/api/physiology?athleteId=${encodeURIComponent(athleteId)}`, {
    method: "GET",
    headers: await buildSupabaseAuthHeaders({ "Content-Type": "application/json" }),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    return {
      athleteId,
      computedAt: new Date().toISOString(),
      results: [],
      error: payload.error ?? "Physiology fetch failed",
    };
  }
  return (await response.json()) as PhysiologyViewModel & { error?: string | null };
}
