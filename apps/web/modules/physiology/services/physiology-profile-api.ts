import type { CanonicalPhysiologyState } from "@/lib/physiology/profile-resolver";
import { buildSupabaseAuthHeaders } from "@/lib/auth/client-auth";

export async function fetchCanonicalPhysiologyProfile(athleteId: string): Promise<CanonicalPhysiologyState> {
  const response = await fetch(`/api/physiology/profile?athleteId=${encodeURIComponent(athleteId)}`, {
    method: "GET",
    headers: await buildSupabaseAuthHeaders({ "Content-Type": "application/json" }),
    cache: "no-store",
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error ?? "Fetch canonical physiology profile failed");
  }

  return (await response.json()) as CanonicalPhysiologyState;
}
