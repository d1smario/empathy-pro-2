import { buildSupabaseAuthHeaders } from "@/lib/auth/client-auth";
import { fetchWithTimeout } from "@/lib/http/fetch-with-timeout";

export async function saveVo2maxLab(input: {
  athleteId: string;
  vo2max_ml_min_kg: number;
  source: "manual" | "gas_exchange_file" | string;
  note?: string | null;
  parsePreview?: Record<string, unknown> | null;
}) {
  const response = await fetchWithTimeout("/api/physiology/vo2max-lab", {
    method: "POST",
    headers: await buildSupabaseAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error ?? "Salvataggio VO2max laboratorio fallito");
  }
  return (await response.json()) as { status: string; vo2max_ml_min_kg: number };
}

export async function clearVo2maxLab(athleteId: string) {
  const response = await fetchWithTimeout("/api/physiology/vo2max-lab", {
    method: "DELETE",
    headers: await buildSupabaseAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ athleteId }),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error ?? "Reset VO2max fallito");
  }
  return (await response.json()) as { status: string };
}
