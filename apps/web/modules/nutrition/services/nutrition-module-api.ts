import type { NutritionModuleViewModel, NutritionPlannedWorkoutRow } from "@/api/nutrition/contracts";
import { buildSupabaseAuthHeaders } from "@/lib/auth/client-auth";
import { fetchWithTimeout } from "@/lib/http/fetch-with-timeout";

export type NutritionModuleContext = NutritionModuleViewModel;
export type { NutritionPlannedWorkoutRow };

export async function fetchNutritionModuleContext(input: {
  athleteId: string;
  from: string;
  to: string;
  /** Se impostata e compresa in from…to, la risposta include pathwayModulation + functionalFoodRecommendations (allineati al builder client). */
  pathwayDate?: string;
}): Promise<NutritionModuleContext> {
  const params = new URLSearchParams({
    athleteId: input.athleteId,
    from: input.from,
    to: input.to,
  });
  const pd = input.pathwayDate?.trim();
  if (pd) params.set("pathwayDate", pd);
  let response: Response;
  try {
    response = await fetchWithTimeout(`/api/nutrition/module?${params.toString()}`, {
      method: "GET",
      cache: "no-store",
      credentials: "same-origin",
      headers: await buildSupabaseAuthHeaders({ "Content-Type": "application/json" }),
    });
  } catch (error) {
    return {
      ...input,
      profile: null,
      physio: null,
      physiologyState: null,
      twinState: null,
      recoverySummary: null,
      adaptationGuidance: null,
      operationalContext: null,
      adaptationLoop: null,
      bioenergeticModulation: null,
      athleteMemory: null,
      executed: [],
      planned: [],
      researchTraceSummaries: [],
      metabolicEfficiencyGenerativeModel: null,
      nutritionPerformanceIntegration: null,
      error: error instanceof Error ? error.message : "Nutrition module fetch failed",
    };
  }
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    return {
      ...input,
      profile: null,
      physio: null,
      physiologyState: null,
      twinState: null,
      recoverySummary: null,
      adaptationGuidance: null,
      operationalContext: null,
      adaptationLoop: null,
      bioenergeticModulation: null,
      pathwayModulation: null,
      functionalFoodRecommendations: null,
      metabolicEfficiencyGenerativeModel: null,
      nutritionPerformanceIntegration: null,
      athleteMemory: null,
      executed: [],
      planned: [],
      researchTraceSummaries: [],
      error: payload.error ?? "Nutrition module fetch failed",
    };
  }
  return (await response.json()) as NutritionModuleContext;
}


