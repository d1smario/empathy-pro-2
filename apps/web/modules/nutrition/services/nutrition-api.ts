import type { NutritionViewModel } from "@/api/nutrition/contracts";
import { buildSupabaseAuthHeaders } from "@/lib/auth/client-auth";
import { fetchWithTimeout } from "@/lib/http/fetch-with-timeout";

export async function fetchNutritionViewModel(input: {
  athleteId: string;
  date?: string;
}): Promise<NutritionViewModel & { error?: string | null }> {
  const params = new URLSearchParams({ athleteId: input.athleteId });
  if (input.date) params.set("date", input.date);
  let response: Response;
  try {
    response = await fetchWithTimeout(`/api/nutrition?${params.toString()}`, {
      method: "GET",
      headers: await buildSupabaseAuthHeaders({ "Content-Type": "application/json" }),
    });
  } catch (error) {
    return {
      athleteId: input.athleteId,
      plan: {
        date: input.date ?? "",
        calories: 0,
        carbsG: 0,
        proteinsG: 0,
        fatsG: 0,
        hydrationMl: 0,
      },
      adherenceScore: 0,
      error: error instanceof Error ? error.message : "Nutrition fetch failed",
    };
  }
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    return {
      athleteId: input.athleteId,
      plan: {
        date: input.date ?? "",
        calories: 0,
        carbsG: 0,
        proteinsG: 0,
        fatsG: 0,
        hydrationMl: 0,
      },
      adherenceScore: 0,
      error: payload.error ?? "Nutrition fetch failed",
    };
  }
  return (await response.json()) as NutritionViewModel & { error?: string | null };
}

