import type { IntelligentMealPlanRequest, IntelligentMealPlanResponseBody } from "@/lib/nutrition/intelligent-meal-plan-types";
import { buildSupabaseAuthHeaders } from "@/lib/auth/client-auth";
import { fetchWithTimeout } from "@/lib/http/fetch-with-timeout";

export async function fetchIntelligentMealPlan(
  athleteId: string,
  plan: IntelligentMealPlanRequest,
): Promise<{ ok: true; body: IntelligentMealPlanResponseBody } | { ok: false; error: string; status: number }> {
  let res: Response;
  try {
    res = await fetchWithTimeout("/api/nutrition/intelligent-meal-plan", {
      method: "POST",
      headers: await buildSupabaseAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ athleteId, plan }),
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Network error", status: 0 };
  }

  const j = (await res.json().catch(() => ({}))) as { error?: string } & Partial<IntelligentMealPlanResponseBody>;
  if (!res.ok) {
    return { ok: false, error: j.error ?? `HTTP ${res.status}`, status: res.status };
  }
  if (
    (j.layer !== "llm_orchestration_v1" && j.layer !== "deterministic_meal_assembly_v1") ||
    !Array.isArray(j.slots) ||
    !j.solverBasis ||
    j.solverBasis.source !== "nutrition_meal_plan_solver"
  ) {
    return { ok: false, error: "Risposta API non valida", status: 502 };
  }
  return { ok: true, body: j as IntelligentMealPlanResponseBody };
}
