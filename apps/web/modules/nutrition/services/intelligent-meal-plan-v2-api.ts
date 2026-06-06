import type { IntelligentMealPlanV2Preview } from "@empathy/contracts";
import type { IntelligentMealPlanRequest } from "@/lib/nutrition/intelligent-meal-plan-types";
import { buildSupabaseAuthHeaders } from "@/lib/auth/client-auth";
import { fetchWithTimeout } from "@/lib/http/fetch-with-timeout";

export type MealPlanV2PreviewResponse = {
  preview: IntelligentMealPlanV2Preview;
  v1FallbackAvailable: boolean;
};

export async function fetchMealPlanV2Preview(
  athleteId: string,
  plan: IntelligentMealPlanRequest,
): Promise<{ ok: true; body: MealPlanV2PreviewResponse } | { ok: false; error: string; status: number }> {
  let res: Response;
  try {
    res = await fetchWithTimeout("/api/nutrition/intelligent-meal-plan-v2", {
      method: "POST",
      cache: "no-store",
      credentials: "same-origin",
      headers: await buildSupabaseAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ athleteId, plan }),
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Network error", status: 0 };
  }

  const j = (await res.json().catch(() => ({}))) as { error?: string; preview?: IntelligentMealPlanV2Preview };
  if (!res.ok) {
    return { ok: false, error: j.error ?? `HTTP ${res.status}`, status: res.status };
  }
  if (!j.preview || j.preview.layer !== "nutrition_meal_plan_v2_preview") {
    return { ok: false, error: "Risposta V2 non valida", status: 502 };
  }
  return { ok: true, body: { preview: j.preview, v1FallbackAvailable: true } };
}

export function isMealPlanV2PreviewUiEnabled(): boolean {
  if (process.env.NODE_ENV === "development") return true;
  const v = (process.env.NEXT_PUBLIC_MEAL_PLAN_V2 ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}
