import type { TrainingPlannerContextViewModel } from "@/api/training/contracts";
import type { ResearchPlan } from "@/lib/empathy/schemas";
import { buildSupabaseAuthHeaders } from "@/lib/auth/client-session";

export type FetchTrainingPlannerContextOptions = {
  /** Default true: persist + link research traces on GET. Set false for read-only context; then call `persistTrainingResearchPlans`. */
  persistResearchTraces?: boolean;
};

export async function fetchTrainingPlannerContext(
  athleteId: string,
  options?: FetchTrainingPlannerContextOptions,
): Promise<TrainingPlannerContextViewModel> {
  const params = new URLSearchParams({ athleteId });
  const persist = options?.persistResearchTraces !== false;
  params.set("persistResearchTraces", persist ? "1" : "0");
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
      adaptationGuidance: null,
      nutritionPerformanceIntegration: null,
      crossModuleDynamicsLines: [],
      knowledgeModulation: null,
      researchPlans: [],
      researchTraces: [],
      flags: {},
      strategyHints: [],
      connectedModules: { profile: false, physiology: false, health: false },
      readSpineCoverage: null,
      error: payload.error ?? "Virya context fetch failed",
    };
  }
  return (await response.json()) as TrainingPlannerContextViewModel;
}

/** Explicit batch persist — same `syncResearchTracePlans` as GET when `persistResearchTraces=1`. */
export async function persistTrainingResearchPlans(plans: ResearchPlan[]): Promise<{ ok: boolean; error?: string }> {
  if (!plans.length) return { ok: true };
  const response = await fetch("/api/knowledge/research-traces", {
    method: "POST",
    headers: await buildSupabaseAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ plans }),
    cache: "no-store",
  });
  const payload = (await response.json().catch(() => ({}))) as { error?: string | null };
  if (!response.ok) {
    return { ok: false, error: payload.error ?? `HTTP ${response.status}` };
  }
  return { ok: true };
}

export type { TrainingPlannerContextViewModel };
