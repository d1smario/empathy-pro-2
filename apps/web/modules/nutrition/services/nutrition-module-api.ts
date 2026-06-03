import type { NutritionModuleViewModel, NutritionPlannedWorkoutRow } from "@/api/nutrition/contracts";
import { buildSupabaseAuthHeaders } from "@/lib/auth/client-auth";
import { fetchWithTimeout } from "@/lib/http/fetch-with-timeout";

export type NutritionModuleContext = NutritionModuleViewModel;
export type { NutritionPlannedWorkoutRow };

const NUTRITION_MODULE_TTL_MS = 15_000;
const nutritionModuleCache = new Map<string, { at: number; value: NutritionModuleContext }>();
const nutritionModuleInflight = new Map<string, Promise<NutritionModuleContext>>();

export async function fetchNutritionModuleContext(input: {
  athleteId: string;
  from: string;
  to: string;
  /** Se impostata e compresa in from…to, la risposta include pathwayModulation + functionalFoodRecommendations (allineati al builder client). */
  pathwayDate?: string;
  /** Research traces, metabolic model, cross-domain roadmap (default off per latenza). */
  includeHeavy?: boolean;
  /** Riduce payload/calcolo lato server per casi specifici. */
  /** `light` = profilo + finestra planned/executed senza operational bundle; `pathway` = solo giorno pathway. */
  mode?: "light" | "pathway" | "full";
}): Promise<NutritionModuleContext> {
  const cacheKey = JSON.stringify({
    athleteId: input.athleteId,
    from: input.from,
    to: input.to,
    pathwayDate: input.pathwayDate ?? null,
    includeHeavy: Boolean(input.includeHeavy),
    mode: input.mode ?? null,
  });
  const cached = nutritionModuleCache.get(cacheKey);
  if (cached && Date.now() - cached.at < NUTRITION_MODULE_TTL_MS) {
    return cached.value;
  }
  const inflight = nutritionModuleInflight.get(cacheKey);
  if (inflight) return inflight;

  const run = (async () => {
  const params = new URLSearchParams({
    athleteId: input.athleteId,
    from: input.from,
    to: input.to,
  });
  const pd = input.pathwayDate?.trim();
  if (pd) params.set("pathwayDate", pd);
  if (input.includeHeavy) params.set("includeHeavy", "1");
  if (input.mode) params.set("mode", input.mode);
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
      executed: [],
      planned: [],
      researchTraceSummaries: [],
      pathwayModulation: null,
      functionalFoodRecommendations: null,
      functionalMealSelector: null,
      crossDomainInterpretationRoadmap: null,
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
      functionalMealSelector: null,
      crossDomainInterpretationRoadmap: null,
      metabolicEfficiencyGenerativeModel: null,
      nutritionPerformanceIntegration: null,
      executed: [],
      planned: [],
      researchTraceSummaries: [],
      error: payload.error ?? "Nutrition module fetch failed",
    };
  }
  const ok = (await response.json()) as NutritionModuleContext;
  if (!ok.error) {
    nutritionModuleCache.set(cacheKey, { at: Date.now(), value: ok });
  }
  return ok;
  })().finally(() => {
    nutritionModuleInflight.delete(cacheKey);
  });

  nutritionModuleInflight.set(cacheKey, run);
  return run;
}


