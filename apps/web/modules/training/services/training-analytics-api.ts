import type { TrainingAnalyticsViewModel } from "@/api/training/contracts";
import { buildSupabaseAuthHeaders } from "@/lib/auth/client-session";
import { fetchWithTimeout } from "@/lib/http/fetch-with-timeout";

export async function fetchTrainingAnalyticsRows(input: {
  athleteId: string;
  from: string;
  to: string;
}): Promise<TrainingAnalyticsViewModel> {
  const params = new URLSearchParams(input);
  let response: Response;
  try {
    response = await fetchWithTimeout(`/api/training/analytics?${params.toString()}`, {
      method: "GET",
      headers: await buildSupabaseAuthHeaders({ "Content-Type": "application/json" }),
      cache: "no-store",
    });
  } catch (error) {
    return {
      rows: [],
      plannedRows: [],
      series: [],
      compareSeries: [],
      latest: null,
      windows: null,
      planWindows: null,
      executedVolumeRollup: null,
      recoveryContinuousRollup: null,
      adaptationLoop: null,
      twinState: null,
      athleteMemory: null,
      recoverySummary: null,
      operationalContext: null,
      bioenergeticModulation: null,
      adaptationGuidance: null,
      nutritionPerformanceIntegration: null,
      crossModuleDynamicsLines: [],
      readSpineCoverage: null,
      error: error instanceof Error ? error.message : "Training analytics fetch failed",
    };
  }
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    return {
      rows: [],
      plannedRows: [],
      series: [],
      compareSeries: [],
      latest: null,
      windows: null,
      planWindows: null,
      executedVolumeRollup: null,
      recoveryContinuousRollup: null,
      adaptationLoop: null,
      twinState: null,
      athleteMemory: null,
      recoverySummary: null,
      operationalContext: null,
      bioenergeticModulation: null,
      adaptationGuidance: null,
      nutritionPerformanceIntegration: null,
      crossModuleDynamicsLines: [],
      readSpineCoverage: null,
      error: payload.error ?? "Training analytics fetch failed",
    };
  }
  const payload = (await response.json()) as TrainingAnalyticsViewModel;
  return {
    rows: payload.rows ?? [],
    plannedRows: payload.plannedRows ?? [],
    series: payload.series ?? [],
    compareSeries: payload.compareSeries ?? [],
    latest: payload.latest ?? null,
    windows: payload.windows ?? null,
    planWindows: payload.planWindows ?? null,
    executedVolumeRollup: payload.executedVolumeRollup ?? null,
    recoveryContinuousRollup: payload.recoveryContinuousRollup ?? null,
    adaptationLoop: payload.adaptationLoop ?? null,
    twinState: payload.twinState ?? null,
    athleteMemory: payload.athleteMemory ?? null,
    recoverySummary: payload.recoverySummary ?? null,
    operationalContext: payload.operationalContext ?? null,
    bioenergeticModulation: payload.bioenergeticModulation ?? null,
    adaptationGuidance: payload.adaptationGuidance ?? null,
    nutritionPerformanceIntegration: payload.nutritionPerformanceIntegration ?? null,
    crossModuleDynamicsLines: payload.crossModuleDynamicsLines ?? [],
    readSpineCoverage: payload.readSpineCoverage ?? null,
    error: payload.error,
    athleteId: payload.athleteId,
    from: payload.from,
    to: payload.to,
  };
}
