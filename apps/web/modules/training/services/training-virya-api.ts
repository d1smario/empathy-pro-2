import type { TrainingPlannerContextViewModel } from "@/api/training/contracts";
import { buildSupabaseAuthHeaders } from "@/lib/auth/client-session";

export async function fetchTrainingPlannerContext(athleteId: string): Promise<TrainingPlannerContextViewModel> {
  const params = new URLSearchParams({ athleteId });
  const response = await fetch(`/api/training/virya-context?${params.toString()}`, {
    method: "GET",
    headers: await buildSupabaseAuthHeaders({ "Content-Type": "application/json" }),
    cache: "no-store",
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    return {
      athleteId,
      profile: null,
      physiology: null,
      physiologyState: null,
      health: null,
      latestLab: null,
      twinState: null,
      athleteMemory: null,
      recoverySummary: null,
      operationalContext: null,
      adaptationLoop: null,
      bioenergeticModulation: null,
      knowledgeModulation: null,
      researchPlans: [],
      researchTraces: [],
      flags: {},
      strategyHints: [],
      connectedModules: { profile: false, physiology: false, health: false },
      error: payload.error ?? "Virya context fetch failed",
    };
  }
  return (await response.json()) as TrainingPlannerContextViewModel;
}

export type { TrainingPlannerContextViewModel };
